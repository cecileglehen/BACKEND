import 'package:flutter/material.dart';

import '../api/deltai_api.dart';
import '../models/models.dart';
import '../theme/delt_theme.dart';
import '../widgets/delt_ui.dart';

class UsageScreen extends StatefulWidget {
  const UsageScreen({super.key, required this.api});
  final DeltaIApi api;

  @override
  State<UsageScreen> createState() => _UsageScreenState();
}

class _UsageScreenState extends State<UsageScreen> {
  String _period = '30d';
  DeltUsageStats? _stats;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final stats = await widget.api.usage(period: _period);
      if (!mounted) return;
      setState(() => _stats = stats);
    } on DeltApiException catch (e) {
      if (mounted) DeltUI.error(context, e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Utilisation'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 60),
                children: [
                  _PeriodSelector(
                    value: _period,
                    onChange: (v) {
                      setState(() => _period = v);
                      _load();
                    },
                  ),
                  const SizedBox(height: 16),
                  if (_stats != null) ...[
                    _SummaryGrid(stats: _stats!),
                    const SizedBox(height: 16),
                    _DailyChart(daily: _stats!.daily),
                    const SizedBox(height: 16),
                    _ByModelList(byModel: _stats!.byModel),
                  ],
                ],
              ),
            ),
    );
  }
}

class _PeriodSelector extends StatelessWidget {
  const _PeriodSelector({required this.value, required this.onChange});
  final String value;
  final ValueChanged<String> onChange;

  @override
  Widget build(BuildContext context) {
    const periods = [
      ('7d', '7 jours'),
      ('30d', '30 jours'),
      ('90d', '90 jours'),
      ('all', 'Tout'),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final p in periods) ...[
            ChoiceChip(
              label: Text(p.$2),
              selected: value == p.$1,
              onSelected: (_) => onChange(p.$1),
              selectedColor: DeltColors.text,
              labelStyle: TextStyle(
                color: value == p.$1 ? Colors.white : DeltColors.text,
                fontWeight: FontWeight.w700,
              ),
              side: const BorderSide(color: DeltColors.border),
              backgroundColor: Colors.white,
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _SummaryGrid extends StatelessWidget {
  const _SummaryGrid({required this.stats});
  final DeltUsageStats stats;

  @override
  Widget build(BuildContext context) {
    final cards = [
      ('Crédits', stats.totalCredits.toStringAsFixed(2), Icons.bolt_rounded, const Color(0xFF6366F1)),
      ('Tokens in', _format(stats.totalTokensIn), Icons.arrow_downward_rounded, const Color(0xFF10B981)),
      ('Tokens out', _format(stats.totalTokensOut), Icons.arrow_upward_rounded, const Color(0xFFF59E0B)),
    ];
    return Row(
      children: [
        for (var i = 0; i < cards.length; i++) ...[
          Expanded(
            child: _StatCard(
              label: cards[i].$1,
              value: cards[i].$2,
              icon: cards[i].$3,
              color: cards[i].$4,
            ),
          ),
          if (i < cards.length - 1) const SizedBox(width: 10),
        ],
      ],
    );
  }

  static String _format(num n) {
    if (n >= 1e6) return '${(n / 1e6).toStringAsFixed(1)}M';
    if (n >= 1e3) return '${(n / 1e3).toStringAsFixed(1)}K';
    return n.toString();
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: DeltColors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(8),
            ),
            alignment: Alignment.center,
            child: Icon(icon, color: color, size: 16),
          ),
          const SizedBox(height: 10),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: DeltColors.muted,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: DeltColors.text,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _DailyChart extends StatelessWidget {
  const _DailyChart({required this.daily});
  final List<Map<String, dynamic>> daily;

  @override
  Widget build(BuildContext context) {
    if (daily.isEmpty) {
      return _EmptyCard(label: 'Pas de données pour cette période.');
    }
    final maxCredits = daily
        .map((d) => (d['credits'] as num? ?? 0).toDouble())
        .fold<double>(0, (a, b) => a > b ? a : b);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: DeltColors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Crédits par jour',
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 100,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final d in daily.take(60)) ...[
                  Expanded(
                    child: _Bar(
                      ratio: maxCredits > 0
                          ? ((d['credits'] as num? ?? 0) / maxCredits).toDouble()
                          : 0,
                    ),
                  ),
                  const SizedBox(width: 2),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.ratio});
  final double ratio;

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      heightFactor: ratio.clamp(0.02, 1.0),
      child: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: [DeltColors.accent, Color(0xFF818CF8)],
          ),
          borderRadius: BorderRadius.circular(3),
        ),
      ),
    );
  }
}

class _ByModelList extends StatelessWidget {
  const _ByModelList({required this.byModel});
  final List<Map<String, dynamic>> byModel;

  @override
  Widget build(BuildContext context) {
    if (byModel.isEmpty) {
      return _EmptyCard(label: 'Aucune utilisation par modèle.');
    }
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: DeltColors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(14, 14, 14, 6),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Par modèle',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13),
              ),
            ),
          ),
          for (var i = 0; i < byModel.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: DeltColors.border),
            ListTile(
              dense: true,
              title: Text(
                '${byModel[i]['model'] ?? '—'}',
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
              subtitle: Text(
                '${byModel[i]['tokens_in'] ?? 0} in / ${byModel[i]['tokens_out'] ?? 0} out',
                style: const TextStyle(fontSize: 11, color: DeltColors.muted),
              ),
              trailing: Text(
                '${(byModel[i]['credits'] as num? ?? 0).toStringAsFixed(2)} Cr',
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  color: DeltColors.accent,
                ),
              ),
            ),
          ],
          const SizedBox(height: 6),
        ],
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: DeltColors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Center(
        child: Text(
          label,
          style: const TextStyle(color: DeltColors.muted, fontSize: 12),
        ),
      ),
    );
  }
}
