import 'package:flutter/material.dart';

import '../models/models.dart';
import '../theme/delt_theme.dart';
import 'delt_components.dart';

/// Catalogue CURÉ du sélecteur (miroir de client/src/lib/modelPicker.jsx) :
/// 3-4 modèles par marque avec un "kind" → icône. Les autres modèles existent
/// toujours côté routeur, ils sont juste masqués du sélecteur.
class CuratedModel {
  const CuratedModel(this.id, this.label, this.kind, {this.children});
  final String id;
  final String label;
  final String kind; // fast | chat | think | image
  // Sous-famille dépliable (ex. GPT-5.6 → Sol / Terra / Luna). Quand présent,
  // l'entrée agit comme un accordéon et [id] n'est pas sélectionnable.
  final List<CuratedModel>? children;
}

class CuratedBrand {
  const CuratedBrand(this.brand, this.label, this.models);
  final String brand;
  final String label;
  final List<CuratedModel> models;
}

const curatedPicker = <CuratedBrand>[
  CuratedBrand('OpenAI', 'GPT', [
    CuratedModel('openai/gpt-5.6-luna', 'GPT Luna', 'fast'),
    CuratedModel('openai/gpt-5.4', 'GPT-5.4', 'chat'),
    CuratedModel('family:gpt-5.6', 'GPT-5.6', 'think', children: [
      CuratedModel('openai/gpt-5.6-sol', 'GPT Sol', 'think'),
      CuratedModel('openai/gpt-5.6-terra', 'GPT Terra', 'chat'),
      CuratedModel('openai/gpt-5.6-luna', 'GPT Luna', 'fast'),
    ]),
    CuratedModel('openai/gpt-5.4-image-2', 'GPT Image 2', 'image'),
  ]),
  CuratedBrand('Anthropic', 'Claude', [
    CuratedModel('anthropic/claude-haiku-4.5', 'Haiku 4.5', 'fast'),
    CuratedModel('anthropic/claude-sonnet-5', 'Sonnet 5', 'chat'),
    CuratedModel('anthropic/claude-opus-4.8', 'Opus 4.8', 'think'),
    CuratedModel('anthropic/claude-fable-5', 'Fable 5', 'think'),
  ]),
  CuratedBrand('Google', 'Gemini', [
    CuratedModel('google/gemini-2.5-flash', 'Gemini 2.5 Flash', 'fast'),
    CuratedModel('google/gemini-3.6-flash', 'Gemini 3.6 Flash', 'chat'),
    CuratedModel('google/gemini-3.1-flash-lite-image', 'Nano Banana Flash Lite', 'image'),
    CuratedModel('google/gemini-3.1-flash-image-preview', 'Nano Banana 2', 'image'),
  ]),
  CuratedBrand('xAI', 'Grok', [
    CuratedModel('x-ai/grok-4.3', 'Grok 4.3', 'chat'),
    CuratedModel('x-ai/grok-4.5', 'Grok 4.5', 'think'),
  ]),
  CuratedBrand('Mistral', 'Mistral', [
    CuratedModel('mistralai/mistral-small-2603', 'Small 4', 'fast'),
    CuratedModel('mistralai/mistral-medium-3-5', 'Medium 3.5', 'chat'),
    CuratedModel('mistralai/mistral-large', 'Large 3', 'think'),
  ]),
  CuratedBrand('DeepSeek', 'DeepSeek', [
    CuratedModel('deepseek/deepseek-v4-flash', 'V4 Flash', 'fast'),
    CuratedModel('deepseek/deepseek-v4-pro', 'V4 Pro', 'chat'),
  ]),
  CuratedBrand('Qwen', 'Qwen', [
    CuratedModel('qwen/qwen3.5-flash-02-23', '3.5 Flash', 'fast'),
    CuratedModel('qwen/qwen3.6-plus', '3.6 Plus', 'chat'),
    CuratedModel('qwen/qwen3-max-thinking', 'Max Thinking', 'think'),
  ]),
  CuratedBrand('Z.ai', 'GLM', [
    CuratedModel('z-ai/glm-5.2', 'GLM 5.2', 'chat'),
  ]),
  CuratedBrand('Meta', 'Llama', [
    CuratedModel('meta-llama/llama-4-maverick', 'Llama 4 Maverick', 'chat'),
  ]),
  CuratedBrand('Perplexity', 'Perplexity', [
    CuratedModel('perplexity/sonar', 'Sonar', 'fast'),
    CuratedModel('perplexity/sonar-deep-research', 'Sonar Deep Research', 'think'),
  ]),
  CuratedBrand('Nova', 'Nova', [
    CuratedModel('amazon/nova-2-lite-v1', 'Nova 2 Lite', 'fast'),
    CuratedModel('amazon/nova-pro-v1', 'Nova Pro', 'chat'),
    CuratedModel('amazon/nova-premier-v1', 'Nova Premier', 'think'),
  ]),
];

/// Marque depuis le préfixe d'un id de modèle (verrou de conversation).
const _idPrefixBrand = <String, String>{
  'openai/': 'OpenAI',
  'anthropic/': 'Anthropic',
  'google/': 'Google',
  'x-ai/': 'xAI',
  'mistralai/': 'Mistral',
  'deepseek/': 'DeepSeek',
  'qwen/': 'Qwen',
  'z-ai/': 'Z.ai',
  'meta-llama/': 'Meta',
  'perplexity/': 'Perplexity',
  'amazon/': 'Nova',
  'moonshotai/': 'Moonshot',
  'inclusionai/': 'InclusionAI',
  'arcee-ai/': 'Arcee',
  'cognitivecomputations/': 'Venice',
  'minimax/': 'MiniMax',
};

String? brandFromModelId(String? id) {
  if (id == null) return null;
  for (final e in _idPrefixBrand.entries) {
    if (id.startsWith(e.key)) return e.value;
  }
  return null;
}

IconData kindIcon(String kind) => switch (kind) {
  'fast' => Icons.bolt,
  'think' => Icons.psychology_outlined,
  'image' => Icons.image_outlined,
  _ => Icons.chat_bubble_outline,
};

/// Ouvre le sélecteur de modèles (bottom sheet, façon site).
/// [lockBrand] : conversation verrouillée sur une marque → on ne propose QUE
/// cette marque (curée si connue, sinon reconstruite depuis le catalogue) et
/// on masque « Auto ».
Future<void> showModelPicker({
  required BuildContext context,
  required List<DeltModel> catalog,
  required DeltModel? selected,
  required bool autoMode,
  String? lockBrand,
  required void Function(DeltModel? model) onSelect, // null = Auto
}) {
  // Groupes affichés : curés, filtrés par le verrou. Marque hors catalogue
  // curé → groupe reconstruit depuis le catalogue serveur (jamais tout).
  List<CuratedBrand> groups;
  if (lockBrand != null) {
    final curated = curatedPicker.where((b) => b.brand == lockBrand).toList();
    if (curated.isNotEmpty) {
      groups = curated;
    } else {
      final models = catalog
          .where((m) => m.brand == lockBrand && m.tier != 'LEGACY')
          .map((m) => CuratedModel(m.id, m.display, 'chat'))
          .toList();
      groups = models.isEmpty
          ? const []
          : [CuratedBrand(lockBrand, lockBrand, models)];
    }
  } else {
    groups = curatedPicker;
  }

  DeltModel resolve(CuratedModel c, String brand) {
    return catalog.firstWhere(
      (m) => m.id == c.id,
      orElse: () => DeltModel(
        id: c.id,
        brand: brand,
        display: c.label,
        tier: 'NORMAL',
        cost: 0,
      ),
    );
  }

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (ctx) => _ModelPickerBody(
      groups: groups,
      selected: selected,
      autoMode: autoMode,
      lockBrand: lockBrand,
      resolve: resolve,
      onSelect: onSelect,
    ),
  );
}

/// Corps du sélecteur (façon site) : d'abord la GRILLE DE LOGOS des marques ;
/// taper une marque déroule ses 3-4 modèles curés en dessous (accordéon).
class _ModelPickerBody extends StatefulWidget {
  const _ModelPickerBody({
    required this.groups,
    required this.selected,
    required this.autoMode,
    required this.lockBrand,
    required this.resolve,
    required this.onSelect,
  });

  final List<CuratedBrand> groups;
  final DeltModel? selected;
  final bool autoMode;
  final String? lockBrand;
  final DeltModel Function(CuratedModel, String) resolve;
  final void Function(DeltModel?) onSelect;

  @override
  State<_ModelPickerBody> createState() => _ModelPickerBodyState();
}

class _ModelPickerBodyState extends State<_ModelPickerBody> {
  String? _openBrand;
  String? _openFamily; // id de la sous-famille dépliée (ex. "family:gpt-5.6")

  @override
  void initState() {
    super.initState();
    // Marque verrouillée ou du modèle sélectionné → déroulée d'office.
    _openBrand =
        widget.lockBrand ??
        (widget.selected != null ? brandFromModelId(widget.selected!.id) : null);
  }

  @override
  Widget build(BuildContext context) {
    final open = widget.groups
        .where((b) => b.brand == _openBrand)
        .firstOrNull;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.72,
      maxChildSize: 0.92,
      builder: (ctx, scrollCtrl) => Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: DeltColors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
            child: Row(
              children: [
                const Text(
                  'Modèle',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    letterSpacing: -0.3,
                  ),
                ),
                const Spacer(),
                if (widget.lockBrand != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: DeltColors.surface,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: DeltColors.border),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.lock_outline,
                          size: 12,
                          color: DeltColors.muted,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Conversation ${widget.lockBrand}',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: DeltColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              controller: scrollCtrl,
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              children: [
                if (widget.lockBrand == null) ...[
                  _PickerTile(
                    icon: Icons.auto_awesome_outlined,
                    label: 'Auto',
                    sublabel: 'Le routeur choisit le meilleur modèle',
                    selected: widget.autoMode,
                    onTap: () {
                      widget.onSelect(null);
                      Navigator.of(context).pop();
                    },
                  ),
                  const SizedBox(height: 10),
                ],
                // Grille de logos des marques
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final b in widget.groups)
                      _BrandChip(
                        brand: b.brand,
                        label: b.label,
                        selected: _openBrand == b.brand,
                        onTap: () => setState(
                          () => _openBrand =
                              _openBrand == b.brand ? null : b.brand,
                        ),
                      ),
                  ],
                ),
                // Modèles de la marque déroulée
                if (open != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: DeltColors.surface,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: DeltColors.border),
                    ),
                    child: Column(
                      children: [
                        for (final c in open.models) ...[
                          if (c.children == null)
                            _PickerTile(
                              icon: kindIcon(c.kind),
                              label: c.label,
                              selected:
                                  !widget.autoMode &&
                                  widget.selected?.id == c.id,
                              onTap: () {
                                widget.onSelect(
                                  widget.resolve(c, open.brand),
                                );
                                Navigator.of(context).pop();
                              },
                            )
                          else ...[
                            // Sous-famille dépliable (flèche) — GPT-5.6 → Sol/Terra/Luna
                            _PickerTile(
                              icon: kindIcon(c.kind),
                              label: c.label,
                              trailing: _openFamily == c.id
                                  ? Icons.expand_less
                                  : Icons.expand_more,
                              selected: c.children!.any(
                                (s) =>
                                    !widget.autoMode &&
                                    widget.selected?.id == s.id,
                              ),
                              onTap: () => setState(
                                () => _openFamily =
                                    _openFamily == c.id ? null : c.id,
                              ),
                            ),
                            if (_openFamily == c.id)
                              Padding(
                                padding: const EdgeInsets.only(left: 22),
                                child: Column(
                                  children: [
                                    for (final s in c.children!)
                                      _PickerTile(
                                        icon: kindIcon(s.kind),
                                        label: s.label,
                                        selected:
                                            !widget.autoMode &&
                                            widget.selected?.id == s.id,
                                        onTap: () {
                                          widget.onSelect(
                                            widget.resolve(s, open.brand),
                                          );
                                          Navigator.of(context).pop();
                                        },
                                      ),
                                  ],
                                ),
                              ),
                          ],
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BrandChip extends StatelessWidget {
  const _BrandChip({
    required this.brand,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String brand;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 8, 14, 8),
        decoration: BoxDecoration(
          color: selected ? DeltColors.text : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? DeltColors.text : DeltColors.border,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            BrandIcon(brand: brand, size: 18),
            const SizedBox(width: 7),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: selected ? Colors.white : DeltColors.text,
              ),
            ),
            const SizedBox(width: 3),
            Icon(
              selected ? Icons.expand_less : Icons.expand_more,
              size: 14,
              color: selected ? Colors.white70 : DeltColors.muted,
            ),
          ],
        ),
      ),
    );
  }
}

class _PickerTile extends StatelessWidget {
  const _PickerTile({
    required this.icon,
    required this.label,
    this.sublabel,
    this.trailing,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String? sublabel;
  final IconData? trailing; // chevron des sous-familles dépliables
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? DeltColors.panel : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: DeltColors.surface,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 16, color: DeltColors.textSoft),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (sublabel != null)
                    Text(
                      sublabel!,
                      style: const TextStyle(
                        fontSize: 11,
                        color: DeltColors.muted,
                      ),
                    ),
                ],
              ),
            ),
            if (trailing != null)
              Icon(trailing, size: 16, color: DeltColors.muted)
            else if (selected)
              const Icon(Icons.check, size: 16, color: DeltColors.accent),
          ],
        ),
      ),
    );
  }
}
