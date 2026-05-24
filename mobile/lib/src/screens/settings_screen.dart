import 'package:flutter/material.dart';

import '../api/deltai_api.dart';
import '../models/models.dart';
import '../theme/delt_theme.dart';
import '../widgets/delt_components.dart';
import 'api_keys_screen.dart';
import 'code_studio_screen.dart';
import 'privacy_screen.dart';
import 'studio_screen.dart';
import 'subscribe_screen.dart';
import 'usage_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    required this.api,
    required this.user,
    required this.models,
    required this.onAccountDeleted,
  });

  final DeltaIApi api;
  final DeltUser user;
  final List<DeltModel> models;
  final VoidCallback onAccountDeleted;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  static const _tierOrder = [
    'FREE',
    'UNCENSORED',
    'PICO',
    'NANO',
    'MINI',
    'NORMAL',
    'EXPERT',
    'PRO',
  ];

  final _prefs = <String, String>{};
  final _displayName = TextEditingController();
  final _role = TextEditingController();
  final _customInterest = TextEditingController();
  final _context = TextEditingController();
  final _interests = <String>[];
  String _tone = 'amical';
  num _credits = 0;
  num _apiCredits = 0;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  static const _interestSuggestions = [
    'Développement web',
    'Mobile / Flutter',
    'IA & Machine Learning',
    'Design UI/UX',
    'Cybersécurité',
    'Data science',
    'DevOps',
    'Startup & business',
    'Marketing digital',
    'Écriture / Rédaction',
    'Musique',
    'Cinéma & vidéo',
    'Jeux vidéo',
    'Sport & fitness',
    'Cuisine',
    'Voyage',
    'Philosophie',
    'Sciences',
    'Histoire',
    'Finance / Crypto',
  ];

  static const _tones = [
    ('neutre', 'Neutre', '💼'),
    ('amical', 'Amical', '😊'),
    ('concis', 'Concis', '⚡'),
    ('détaillé', 'Détaillé', '📚'),
    ('créatif', 'Créatif', '✨'),
    ('humoristique', 'Humour', '😄'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _displayName.dispose();
    _role.dispose();
    _customInterest.dispose();
    _context.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        widget.api.modelPreferences(),
        widget.api.memory(),
        widget.api.quotaDetails(),
      ]);
      final prefs = results[0] as Map<String, String>;
      final memory = results[1];
      final quota = results[2];
      final initial = <String, String>{...prefs};
      for (final tier in _tierOrder) {
        initial.putIfAbsent(tier, () {
          final model = _modelsForTier(tier).firstOrNull;
          return model?.id ?? '';
        });
      }
      final profile = memory['profile'] is Map<String, dynamic>
          ? memory['profile'] as Map<String, dynamic>
          : <String, dynamic>{};
      setState(() {
        _prefs
          ..clear()
          ..addAll(initial);
        _displayName.text = '${memory['displayName'] ?? ''}';
        _role.text = '${profile['role'] ?? ''}';
        _context.text = '${profile['context'] ?? ''}';
        _tone = '${profile['tone'] ?? 'amical'}';
        _interests
          ..clear()
          ..addAll(
            (profile['interests'] as List? ?? const [])
                .map((item) => '$item')
                .take(12),
          );
        _credits = quota['credits'] is num ? quota['credits'] as num : 0;
        _apiCredits = quota['apiCredits'] is num ? quota['apiCredits'] as num : 0;
      });
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final clean = Map<String, String>.from(_prefs)
        ..removeWhere((_, value) => value.isEmpty);
      await widget.api.setModelPreferences(clean);
      await widget.api.setMemory(
        displayName: _displayName.text.trim().isEmpty
            ? null
            : _displayName.text.trim(),
        profile: {
          'interests': _interests,
          'role': _role.text.trim().isEmpty ? null : _role.text.trim(),
          'tone': _tone,
          'context': _context.text.trim().isEmpty ? null : _context.text.trim(),
        },
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Préférences enregistrées')),
      );
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  List<DeltModel> _modelsForTier(String tier) => widget.models
      .where((model) => model.tier == tier)
      .toList()
    ..sort((a, b) => a.display.compareTo(b.display));

  List<String> get _availableTiers => _tierOrder
      .where((tier) => widget.models.any((model) => model.tier == tier))
      .toList();

  void _toggleInterest(String interest) {
    setState(() {
      if (_interests.contains(interest)) {
        _interests.remove(interest);
      } else if (_interests.length < 12) {
        _interests.add(interest);
      }
    });
  }

  void _addCustomInterest() {
    final value = _customInterest.text.trim();
    if (value.isEmpty) return;
    if (!_interests.contains(value) && _interests.length < 12) {
      setState(() => _interests.add(value));
    }
    _customInterest.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Paramètres'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
              children: [
                _SectionCard(
                  title: 'Compte',
                  child: Column(
                    children: [
                      _InfoRow(label: 'Email', value: widget.user.email),
                      const SizedBox(height: 10),
                      _InfoRow(label: 'Plan', value: widget.user.plan),
                      const SizedBox(height: 10),
                      _InfoRow(
                        label: 'Crédits chat',
                        value: '${_credits.toStringAsFixed(2)} Cr',
                      ),
                      const SizedBox(height: 10),
                      _InfoRow(
                        label: 'Crédits API',
                        value: '${_apiCredits.toStringAsFixed(2)} Cr',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                _SectionCard(
                  title: 'Fiche identité',
                  subtitle:
                      'Ces infos personnalisent les réponses de tous les modèles, comme sur le site.',
                  child: _MemoryForm(
                    displayName: _displayName,
                    role: _role,
                    customInterest: _customInterest,
                    contextController: _context,
                    interests: _interests,
                    tone: _tone,
                    tones: _tones,
                    suggestions: _interestSuggestions,
                    onTone: (tone) => setState(() => _tone = tone),
                    onInterest: _toggleInterest,
                    onAddCustom: _addCustomInterest,
                  ),
                ),
                const SizedBox(height: 14),
                _SectionCard(
                  title: 'Mode Auto',
                  subtitle:
                      'Comme sur le site, DELT route la question vers un tier, puis utilise ton modèle préféré pour ce tier.',
                  child: Column(
                    children: [
                      for (final tier in _availableTiers) ...[
                        _TierPreference(
                          tier: tier,
                          models: _modelsForTier(tier),
                          selectedId: _prefs[tier],
                          onChanged: (id) => setState(() => _prefs[tier] = id),
                        ),
                        if (tier != _availableTiers.last)
                          const SizedBox(height: 12),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                _SectionCard(
                  title: 'Outils',
                  subtitle: 'Toutes les fonctionnalités de DeltaAI à portée de main.',
                  child: Column(
                    children: [
                      _ToolLink(
                        icon: Icons.auto_awesome_outlined,
                        color: const Color(0xFF8B5CF6),
                        label: 'Studio créatif',
                        sub: 'Image · Vidéo · Musique',
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => StudioScreen(api: widget.api),
                          ),
                        ),
                      ),
                      _ToolLink(
                        icon: Icons.code_rounded,
                        color: const Color(0xFF0EA5E9),
                        label: 'Code Studio',
                        sub: 'Génère et itère des apps web',
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => CodeStudioScreen(api: widget.api),
                          ),
                        ),
                      ),
                      _ToolLink(
                        icon: Icons.workspace_premium_outlined,
                        color: const Color(0xFFF59E0B),
                        label: 'Abonnement',
                        sub: 'Plan ${widget.user.plan} · Gérer',
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => SubscribeScreen(
                              api: widget.api,
                              user: widget.user,
                            ),
                          ),
                        ),
                      ),
                      _ToolLink(
                        icon: Icons.bar_chart_rounded,
                        color: const Color(0xFF10B981),
                        label: 'Utilisation',
                        sub: 'Crédits, tokens, par modèle',
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => UsageScreen(api: widget.api),
                          ),
                        ),
                      ),
                      _ToolLink(
                        icon: Icons.vpn_key_outlined,
                        color: const Color(0xFF6366F1),
                        label: 'Clés API',
                        sub: 'Compatible OpenAI SDK',
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ApiKeysScreen(api: widget.api),
                          ),
                        ),
                      ),
                      _ToolLink(
                        icon: Icons.shield_outlined,
                        color: const Color(0xFFDC2626),
                        label: 'Confidentialité',
                        sub: 'Export RGPD · Suppression',
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => PrivacyScreen(
                              api: widget.api,
                              onAccountDeleted: widget.onAccountDeleted,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF1F2),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFFECACA)),
                    ),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                ],
              ],
            ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
          child: FilledButton.icon(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(
                    width: 17,
                    height: 17,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.check_rounded),
            label: Text(_saving ? 'Enregistrement...' : 'Enregistrer'),
            style: FilledButton.styleFrom(
              backgroundColor: DeltColors.text,
              minimumSize: const Size.fromHeight(50),
            ),
          ),
        ),
      ),
    );
  }
}

class _ToolLink extends StatelessWidget {
  const _ToolLink({
    required this.icon,
    required this.color,
    required this.label,
    required this.sub,
    required this.onTap,
  });
  final IconData icon;
  final Color color;
  final String label;
  final String sub;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: color.withValues(alpha: .12),
                borderRadius: BorderRadius.circular(11),
              ),
              alignment: Alignment.center,
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    sub,
                    style: const TextStyle(
                      color: DeltColors.muted,
                      fontSize: 11.5,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: DeltColors.muted),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child, this.subtitle});
  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: DeltColors.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 6),
            Text(
              subtitle!,
              style: const TextStyle(
                color: DeltColors.muted,
                fontSize: 12,
                height: 1.3,
              ),
            ),
          ],
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: DeltColors.surface,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              color: DeltColors.muted,
              fontSize: 10,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class _MemoryForm extends StatelessWidget {
  const _MemoryForm({
    required this.displayName,
    required this.role,
    required this.customInterest,
    required this.contextController,
    required this.interests,
    required this.tone,
    required this.tones,
    required this.suggestions,
    required this.onTone,
    required this.onInterest,
    required this.onAddCustom,
  });

  final TextEditingController displayName;
  final TextEditingController role;
  final TextEditingController customInterest;
  final TextEditingController contextController;
  final List<String> interests;
  final String tone;
  final List<(String, String, String)> tones;
  final List<String> suggestions;
  final ValueChanged<String> onTone;
  final ValueChanged<String> onInterest;
  final VoidCallback onAddCustom;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: displayName,
          maxLength: 60,
          decoration: const InputDecoration(
            labelText: "Comment l'IA doit-elle t'appeler ?",
            hintText: 'Ex : Thomas, Léa, Captain...',
            counterText: '',
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: role,
          maxLength: 100,
          decoration: const InputDecoration(
            labelText: 'Ton rôle / métier',
            hintText: 'Ex : Développeur full-stack',
            counterText: '',
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            const Expanded(
              child: Text(
                "Centres d'intérêt",
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
              ),
            ),
            Text(
              '${interests.length} / 12',
              style: const TextStyle(fontSize: 10, color: DeltColors.muted),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final item in suggestions)
              FilterChip(
                selected: interests.contains(item),
                label: Text(item),
                onSelected: (_) => onInterest(item),
                visualDensity: VisualDensity.compact,
              ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: customInterest,
                maxLength: 50,
                decoration: const InputDecoration(
                  hintText: "Centre d'intérêt personnalisé",
                  counterText: '',
                ),
                onSubmitted: (_) => onAddCustom(),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              onPressed: onAddCustom,
              icon: const Icon(Icons.add_rounded),
            ),
          ],
        ),
        const SizedBox(height: 14),
        const Text(
          'Ton préféré',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 8),
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: 1.25,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
          children: [
            for (final item in tones)
              _ToneTile(
                id: item.$1,
                label: item.$2,
                emoji: item.$3,
                selected: tone == item.$1,
                onTap: () => onTone(item.$1),
              ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: contextController,
          maxLength: 500,
          minLines: 3,
          maxLines: 5,
          decoration: const InputDecoration(
            labelText: 'Autre chose à savoir ?',
            hintText: 'Ex : Je travaille sur un projet d’app mobile...',
          ),
        ),
      ],
    );
  }
}

class _ToneTile extends StatelessWidget {
  const _ToneTile({
    required this.id,
    required this.label,
    required this.emoji,
    required this.selected,
    required this.onTap,
  });

  final String id;
  final String label;
  final String emoji;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFFEEF2FF) : Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(
              color: selected ? DeltColors.accent : DeltColors.border,
              width: selected ? 1.5 : 1,
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          alignment: Alignment.center,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(emoji, style: const TextStyle(fontSize: 20)),
              const SizedBox(height: 3),
              Text(
                label,
                style: TextStyle(
                  color: selected ? DeltColors.accent : DeltColors.text,
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TierPreference extends StatelessWidget {
  const _TierPreference({
    required this.tier,
    required this.models,
    required this.selectedId,
    required this.onChanged,
  });

  final String tier;
  final List<DeltModel> models;
  final String? selectedId;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final selected = models.where((m) => m.id == selectedId).firstOrNull ??
        models.firstOrNull;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _TierChip(tier: tier),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                _tierDescription(tier),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: DeltColors.muted, fontSize: 11),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Material(
          color: DeltColors.surface,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () async {
              final chosen = await showModalBottomSheet<DeltModel>(
                context: context,
                useSafeArea: true,
                isScrollControlled: true,
                backgroundColor: Colors.white,
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                builder: (context) => _TierModelSheet(
                  tier: tier,
                  models: models,
                  selectedId: selected?.id,
                ),
              );
              if (chosen != null) onChanged(chosen.id);
            },
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  if (selected != null)
                    BrandIcon(brand: selected.brand, size: 24)
                  else
                    const Icon(Icons.smart_toy_outlined),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          selected?.display ?? 'Aucun modèle',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                        Text(
                          selected?.id ?? '-',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: DeltColors.muted,
                            fontSize: 10,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.expand_more_rounded, color: DeltColors.muted),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _TierModelSheet extends StatelessWidget {
  const _TierModelSheet({
    required this.tier,
    required this.models,
    required this.selectedId,
  });

  final String tier;
  final List<DeltModel> models;
  final String? selectedId;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: .62,
      minChildSize: .4,
      maxChildSize: .9,
      builder: (context, controller) => Column(
        children: [
          Container(
            width: 36,
            height: 4,
            margin: const EdgeInsets.only(top: 10, bottom: 12),
            decoration: BoxDecoration(
              color: DeltColors.border,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: Row(
              children: [
                _TierChip(tier: tier),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'Modèle par défaut',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.separated(
              controller: controller,
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
              itemCount: models.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final model = models[index];
                final selected = model.id == selectedId;
                return ListTile(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(
                      color: selected ? DeltColors.accent : DeltColors.border,
                    ),
                  ),
                  tileColor: selected ? const Color(0xFFEEF2FF) : Colors.white,
                  leading: BrandIcon(brand: model.brand, size: 28),
                  title: Text(
                    model.display,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  subtitle: Text(
                    model.id,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 10),
                  ),
                  trailing: selected
                      ? const Icon(
                          Icons.check_circle_rounded,
                          color: DeltColors.accent,
                        )
                      : null,
                  onTap: () => Navigator.pop(context, model),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _TierChip extends StatelessWidget {
  const _TierChip({required this.tier});
  final String tier;

  @override
  Widget build(BuildContext context) {
    final color = switch (tier) {
      'UNCENSORED' => const Color(0xFFEA580C),
      'PICO' => const Color(0xFF0891B2),
      'NANO' => const Color(0xFF059669),
      'MINI' => const Color(0xFF2563EB),
      'NORMAL' => const Color(0xFF4F46E5),
      'EXPERT' => const Color(0xFF7C3AED),
      'PRO' => const Color(0xFFE11D48),
      _ => DeltColors.muted,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        tier,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

String _tierDescription(String tier) => switch (tier) {
  'FREE' => 'Usage léger',
  'UNCENSORED' => '18+',
  'PICO' => 'Ultra rapide',
  'NANO' => 'Questions simples',
  'MINI' => 'Tâches standard',
  'NORMAL' => 'Questions complexes',
  'EXPERT' => 'Raisonnement profond',
  'PRO' => 'Haut de gamme',
  _ => 'Modèles',
};
