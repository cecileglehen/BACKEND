import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/deltai_api.dart';
import '../models/models.dart';
import '../theme/delt_theme.dart';
import '../widgets/delt_ui.dart';

class SubscribeScreen extends StatefulWidget {
  const SubscribeScreen({super.key, required this.api, required this.user});
  final DeltaIApi api;
  final DeltUser user;

  @override
  State<SubscribeScreen> createState() => _SubscribeScreenState();
}

class _SubscribeScreenState extends State<SubscribeScreen> {
  static const _plans = [
    _PlanData(
      key: 'BASIC',
      label: 'Starter',
      price: 10,
      credits: 1000,
      color: Color(0xFF10B981),
      tagline: 'Pour découvrir DeltaAI',
    ),
    _PlanData(
      key: 'PLUS',
      label: 'Plus',
      price: 30,
      credits: 3500,
      color: Color(0xFF6366F1),
      tagline: 'Le meilleur rapport',
      highlight: true,
    ),
    _PlanData(
      key: 'PRO',
      label: 'Pro',
      price: 75,
      credits: 8500,
      color: Color(0xFF0891B2),
      tagline: 'Usage intensif + API',
    ),
    _PlanData(
      key: 'ULTRA',
      label: 'Ultra',
      price: 200,
      credits: 25000,
      color: Color(0xFFF59E0B),
      tagline: 'Sans limite',
    ),
  ];

  bool _busy = false;

  Future<void> _subscribe(_PlanData plan) async {
    setState(() => _busy = true);
    try {
      final data = await widget.api.subscribeLink(plan.key);
      final url = data['approveUrl']?.toString();
      if (url == null || url.isEmpty) {
        throw DeltApiException('URL PayPal indisponible', status: 500);
      }
      final ok = await launchUrl(
        Uri.parse(url),
        mode: LaunchMode.externalApplication,
      );
      if (!ok && mounted) {
        DeltUI.error(context, 'Impossible d\'ouvrir le navigateur');
      } else if (mounted) {
        DeltUI.info(
          context,
          'Finalise l\'abonnement dans le navigateur, puis reviens ici.',
        );
      }
    } on DeltApiException catch (e) {
      if (mounted) DeltUI.error(context, e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Abonnement'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1D4ED8), Color(0xFF06B6D4)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.star_rounded, color: Colors.white),
                    const SizedBox(width: 8),
                    Text(
                      'Plan actuel : ${widget.user.plan}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Tous les plans payants donnent accès à TOUS les modèles. Seule la quantité de crédits change.',
                  style: TextStyle(color: Colors.white70, fontSize: 12.5, height: 1.4),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          for (final p in _plans) ...[
            _PlanCard(
              plan: p,
              isCurrent: widget.user.plan == p.key,
              busy: _busy,
              onSubscribe: () => _subscribe(p),
            ),
            const SizedBox(height: 12),
          ],
          const SizedBox(height: 8),
          Center(
            child: Text(
              'Paiement sécurisé via PayPal · Annulable à tout moment',
              style: TextStyle(
                color: DeltColors.muted,
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PlanData {
  const _PlanData({
    required this.key,
    required this.label,
    required this.price,
    required this.credits,
    required this.color,
    required this.tagline,
    this.highlight = false,
  });
  final String key;
  final String label;
  final int price;
  final int credits;
  final Color color;
  final String tagline;
  final bool highlight;
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.isCurrent,
    required this.busy,
    required this.onSubscribe,
  });
  final _PlanData plan;
  final bool isCurrent;
  final bool busy;
  final VoidCallback onSubscribe;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(
          color: plan.highlight ? plan.color : DeltColors.border,
          width: plan.highlight ? 2 : 1,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: plan.color.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  plan.label,
                  style: TextStyle(
                    color: plan.color,
                    fontWeight: FontWeight.w900,
                    fontSize: 13,
                  ),
                ),
              ),
              if (plan.highlight) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    '★ Populaire',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF92400E),
                    ),
                  ),
                ),
              ],
              const Spacer(),
              if (isCurrent)
                const Padding(
                  padding: EdgeInsets.only(left: 4),
                  child: Icon(Icons.check_circle, color: Color(0xFF10B981), size: 20),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            plan.tagline,
            style: const TextStyle(color: DeltColors.muted, fontSize: 12.5),
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${plan.price}€',
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                  height: 1,
                ),
              ),
              const SizedBox(width: 4),
              const Padding(
                padding: EdgeInsets.only(bottom: 5),
                child: Text(
                  '/mois',
                  style: TextStyle(color: DeltColors.muted, fontSize: 13),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${plan.credits} crédits / mois',
            style: TextStyle(
              color: plan.color,
              fontWeight: FontWeight.w800,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: isCurrent || busy ? null : onSubscribe,
              style: FilledButton.styleFrom(
                backgroundColor: plan.color,
                disabledBackgroundColor: DeltColors.surface,
                disabledForegroundColor: DeltColors.muted,
                minimumSize: const Size.fromHeight(48),
              ),
              child: Text(
                isCurrent
                    ? 'Plan actuel'
                    : busy
                        ? 'Préparation...'
                        : 'S\'abonner',
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
