import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:image_picker/image_picker.dart';

import '../models/models.dart';
import '../theme/delt_theme.dart';

Color hexColor(String value) {
  final clean = value.replaceFirst('#', '');
  final hex = clean.length == 6 ? 'FF$clean' : clean;
  return Color(int.parse(hex, radix: 16));
}

class DeltLogo extends StatelessWidget {
  const DeltLogo({super.key, this.size = 38, this.showText = false});
  final double size;
  final bool showText;

  @override
  Widget build(BuildContext context) {
    final width = showText ? size * 2.25 : size;
    return Image.asset(
      'assets/brand/logo-delt.png',
      width: width,
      height: size,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
    );
  }
}

class DeltPill extends StatelessWidget {
  const DeltPill({
    super.key,
    required this.child,
    this.selected = false,
    this.onTap,
    this.color,
  });
  final Widget child;
  final bool selected;
  final VoidCallback? onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? DeltColors.text;
    return Material(
      color: selected ? c : Colors.white,
      shape: StadiumBorder(
        side: BorderSide(color: selected ? c : DeltColors.border),
      ),
      child: InkWell(
        onTap: onTap,
        customBorder: const StadiumBorder(),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: DefaultTextStyle.merge(
            style: TextStyle(
              color: selected ? Colors.white : DeltColors.text,
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
            child: IconTheme(
              data: IconThemeData(
                color: selected ? Colors.white : DeltColors.muted,
                size: 17,
              ),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

class BrandConfig {
  const BrandConfig({required this.label, this.asset});
  final String label;
  final String? asset;
}

const brandOrder = <String>[
  'Mistral',
  'OpenAI',
  'Anthropic',
  'Google',
  'Meta',
  'xAI',
  'Perplexity',
  'DeepSeek',
  'Venice',
  'InclusionAI',
  'Arcee',
  'ByteDance',
  'Flux',
  'Recraft',
];

const brandConfig = <String, BrandConfig>{
  'OpenAI': BrandConfig(label: 'GPT', asset: 'assets/brands/openai.svg'),
  'Anthropic': BrandConfig(
    label: 'Claude',
    asset: 'assets/brands/claude-color.svg',
  ),
  'Google': BrandConfig(label: 'Gemini', asset: 'assets/brands/gemini-color.svg'),
  'Mistral': BrandConfig(
    label: 'Mistral',
    asset: 'assets/brands/mistral-color.svg',
  ),
  'xAI': BrandConfig(label: 'Grok', asset: 'assets/brands/grok.svg'),
  'Perplexity': BrandConfig(
    label: 'Perplexity',
    asset: 'assets/brands/perplexity-color.svg',
  ),
  'Meta': BrandConfig(label: 'Llama', asset: 'assets/brands/meta-color.svg'),
  'Venice': BrandConfig(label: 'Venice', asset: 'assets/brands/venice-color.svg'),
  'InclusionAI': BrandConfig(
    label: 'Inclusion',
    asset: 'assets/brands/antgroup-color.svg',
  ),
  'Arcee': BrandConfig(label: 'Arcee', asset: 'assets/brands/arcee-color.png'),
  'DeepSeek': BrandConfig(
    label: 'DeepSeek',
    asset: 'assets/brands/deepseek-color.svg',
  ),
  'ByteDance': BrandConfig(
    label: 'Seedance',
    asset: 'assets/brands/bytedance-color.svg',
  ),
  'Flux': BrandConfig(label: 'FLUX', asset: 'assets/brands/flux.svg'),
  'Recraft': BrandConfig(label: 'Recraft', asset: 'assets/brands/recraft.svg'),
};

String brandLabel(String brand) => brandConfig[brand]?.label ?? brand;

class BrandIcon extends StatelessWidget {
  const BrandIcon({super.key, required this.brand, this.size = 18});
  final String brand;
  final double size;

  @override
  Widget build(BuildContext context) {
    final asset = brandConfig[brand]?.asset;
    if (asset == null) {
      return Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: DeltColors.text,
          shape: BoxShape.circle,
        ),
        child: Text(
          brand.isEmpty ? '?' : brand.characters.first,
          style: TextStyle(
            color: Colors.white,
            fontSize: size * .52,
            fontWeight: FontWeight.w900,
          ),
        ),
      );
    }
    if (asset.endsWith('.svg')) {
      return SvgPicture.asset(
        asset,
        width: size,
        height: size,
        fit: BoxFit.contain,
      );
    }
    return Image.asset(
      asset,
      width: size,
      height: size,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
    );
  }
}

class ModelRail extends StatelessWidget {
  const ModelRail({
    super.key,
    required this.models,
    required this.selected,
    required this.onSelect,
  });
  final List<DeltModel> models;
  final DeltModel? selected;
  final ValueChanged<DeltModel> onSelect;

  @override
  Widget build(BuildContext context) {
    final grouped = _groupModels(models);
    return SizedBox(
      height: 46,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        itemCount: grouped.length,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final entry = grouped[index];
          final brand = entry.key;
          final brandModels = entry.value;
          final selectedHere = brandModels.any((m) => m.id == selected?.id);
          return Material(
            color: selectedHere ? DeltColors.text : Colors.white,
            shape: StadiumBorder(
              side: BorderSide(
                color: selectedHere ? DeltColors.text : DeltColors.border,
              ),
            ),
            clipBehavior: Clip.antiAlias,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                InkWell(
                  onTap: () => onSelect(brandModels.first),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(10, 7, 6, 7),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        BrandIcon(brand: brand, size: 18),
                        const SizedBox(width: 7),
                        Text(
                          brandLabel(brand),
                          style: TextStyle(
                            color: selectedHere
                                ? Colors.white
                                : DeltColors.text,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (brandModels.length > 1)
                  InkWell(
                    onTap: () => showModelSelectorSheet(
                      context,
                      models: models,
                      selected: selected,
                      onSelect: onSelect,
                      initialBrand: brand,
                    ),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(3, 7, 9, 7),
                      child: Icon(
                        Icons.more_horiz_rounded,
                        size: 16,
                        color: selectedHere
                            ? Colors.white70
                            : DeltColors.muted,
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

Future<void> showModelSelectorSheet(
  BuildContext context, {
  required List<DeltModel> models,
  required DeltModel? selected,
  required ValueChanged<DeltModel> onSelect,
  bool showAuto = false,
  bool autoMode = false,
  VoidCallback? onAuto,
  String? initialBrand,
}) {
  final grouped = _groupModels(models);
  final initialIndex = initialBrand == null
      ? 0
      : grouped.indexWhere((entry) => entry.key == initialBrand).clamp(0, grouped.length - 1);
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (context) {
      return DefaultTabController(
        length: grouped.length,
        initialIndex: initialIndex,
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: .72,
          minChildSize: .45,
          maxChildSize: .92,
          builder: (context, scrollController) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    margin: const EdgeInsets.only(top: 10, bottom: 12),
                    decoration: BoxDecoration(
                      color: DeltColors.border,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
                  child: Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Modèle manuel',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                ),
                TabBar(
                  isScrollable: true,
                  tabAlignment: TabAlignment.start,
                  labelColor: DeltColors.text,
                  unselectedLabelColor: DeltColors.muted,
                  indicatorColor: DeltColors.text,
                  tabs: [
                    for (final entry in grouped)
                      Tab(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            BrandIcon(brand: entry.key, size: 18),
                            const SizedBox(width: 7),
                            Text(brandLabel(entry.key)),
                            const SizedBox(width: 5),
                            Text(
                              '${entry.value.length}',
                              style: const TextStyle(fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                Expanded(
                  child: TabBarView(
                    children: [
                      for (final entry in grouped)
                        ListView.separated(
                          controller: scrollController,
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
                          itemCount: entry.value.length + (showAuto ? 1 : 0),
                          separatorBuilder: (_, _) => const SizedBox(height: 8),
                          itemBuilder: (context, index) {
                            if (showAuto && index == 0) {
                              return _AutoOptionTile(
                                selected: autoMode,
                                onTap: () {
                                  onAuto?.call();
                                  Navigator.pop(context);
                                },
                              );
                            }
                            final model = entry.value[index - (showAuto ? 1 : 0)];
                            final active = model.id == selected?.id;
                            return _ModelOptionTile(
                              model: model,
                              selected: active,
                              onTap: () {
                                onSelect(model);
                                Navigator.pop(context);
                              },
                            );
                          },
                        ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      );
    },
  );
}

Future<List<DeltModel>?> showParallelPickerSheet(
  BuildContext context, {
  required List<DeltModel> models,
  required List<DeltModel> selected,
}) {
  var picks = [...selected];
  final all = [...models]..sort((a, b) {
    final tier = _tierRank(a.tier).compareTo(_tierRank(b.tier));
    if (tier != 0) return tier;
    return a.display.compareTo(b.display);
  });

  return showModalBottomSheet<List<DeltModel>>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (context) => StatefulBuilder(
      builder: (context, setSheetState) {
        void toggle(DeltModel model) {
          setSheetState(() {
            final exists = picks.any((m) => m.id == model.id);
            if (exists) {
              picks.removeWhere((m) => m.id == model.id);
            } else if (picks.length < 4) {
              picks.add(model);
            }
          });
        }

        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: .78,
          minChildSize: .5,
          maxChildSize: .92,
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
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Row(
                  children: [
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Comparaison parallèle',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          Text(
                            'Envoie ta question à 2-4 modèles.',
                            style: TextStyle(
                              color: DeltColors.muted,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
              ),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                color: DeltColors.surface,
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: picks.isEmpty
                      ? [
                          const Text(
                            'Aucun modèle sélectionné.',
                            style: TextStyle(
                              color: DeltColors.muted,
                              fontSize: 12,
                            ),
                          ),
                        ]
                      : [
                          for (var i = 0; i < picks.length; i++)
                            Chip(
                              avatar: CircleAvatar(
                                child: Text('${i + 1}'),
                              ),
                              label: Text(picks[i].display),
                              onDeleted: () => toggle(picks[i]),
                            ),
                        ],
                ),
              ),
              Expanded(
                child: ListView.separated(
                  controller: controller,
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 18),
                  itemCount: all.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final model = all[index];
                    final active = picks.any((m) => m.id == model.id);
                    final disabled = !active && picks.length >= 4;
                    return Opacity(
                      opacity: disabled ? .42 : 1,
                      child: ListTile(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(
                            color: active
                                ? DeltColors.accent
                                : DeltColors.border,
                          ),
                        ),
                        tileColor:
                            active ? const Color(0xFFEEF2FF) : Colors.white,
                        leading: BrandIcon(brand: model.brand, size: 28),
                        title: Text(
                          model.display,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                        subtitle: Text(
                          '${model.brand} · ${model.tier}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        trailing: active
                            ? const Icon(
                                Icons.check_circle_rounded,
                                color: DeltColors.accent,
                              )
                            : null,
                        onTap: disabled ? null : () => toggle(model),
                      ),
                    );
                  },
                ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
                  child: Row(
                    children: [
                      TextButton(
                        onPressed: () => Navigator.pop(context, <DeltModel>[]),
                        child: const Text('Désactiver'),
                      ),
                      const Spacer(),
                      FilledButton(
                        onPressed: picks.length >= 2
                            ? () => Navigator.pop(context, picks)
                            : null,
                        style: FilledButton.styleFrom(
                          backgroundColor: DeltColors.text,
                        ),
                        child: Text('Confirmer (${picks.length}/4)'),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    ),
  );
}

class _AutoOptionTile extends StatelessWidget {
  const _AutoOptionTile({required this.selected, required this.onTap});
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFFEEF2FF) : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: selected ? DeltColors.accent : DeltColors.border,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: const Padding(
          padding: EdgeInsets.all(12),
          child: Row(
            children: [
              Icon(Icons.auto_awesome_rounded, color: DeltColors.accent),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Auto',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        color: DeltColors.text,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'DELT choisit le meilleur tier selon ta question.',
                      style: TextStyle(fontSize: 11, color: DeltColors.muted),
                    ),
                  ],
                ),
              ),
              Icon(Icons.route_rounded, size: 19, color: DeltColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}

class _ModelOptionTile extends StatelessWidget {
  const _ModelOptionTile({
    required this.model,
    required this.selected,
    required this.onTap,
  });
  final DeltModel model;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFFEEF2FF) : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: selected ? DeltColors.accent : DeltColors.border,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              BrandIcon(brand: model.brand, size: 26),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            model.display,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: selected
                                  ? DeltColors.accent
                                  : DeltColors.text,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        _TierBadge(tier: model.tier),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      model.id,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 10,
                        color: DeltColors.muted,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
              if (selected) ...[
                const SizedBox(width: 10),
                const Icon(
                  Icons.check_circle_rounded,
                  color: DeltColors.accent,
                  size: 20,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _TierBadge extends StatelessWidget {
  const _TierBadge({required this.tier});
  final String tier;

  @override
  Widget build(BuildContext context) {
    final colors = switch (tier) {
      'UNCENSORED' => (const Color(0xFFFFF7ED), const Color(0xFFEA580C)),
      'NANO' => (const Color(0xFFECFDF5), const Color(0xFF059669)),
      'MINI' => (const Color(0xFFEFF6FF), const Color(0xFF2563EB)),
      'NORMAL' => (const Color(0xFFEEF2FF), const Color(0xFF4F46E5)),
      'EXPERT' || 'PRICE' => (const Color(0xFFF5F3FF), const Color(0xFF7C3AED)),
      'PRO' => (const Color(0xFFFFF1F2), const Color(0xFFE11D48)),
      _ => (DeltColors.surface, DeltColors.muted),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: colors.$1,
        borderRadius: BorderRadius.circular(7),
      ),
      child: Text(
        tier,
        style: TextStyle(
          color: colors.$2,
          fontSize: 10,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

List<MapEntry<String, List<DeltModel>>> _groupModels(List<DeltModel> models) {
  final map = <String, List<DeltModel>>{};
  for (final model in models) {
    map.putIfAbsent(model.brand, () => <DeltModel>[]).add(model);
  }
  for (final list in map.values) {
    list.sort((a, b) {
      final tierCompare = _tierRank(a.tier).compareTo(_tierRank(b.tier));
      if (tierCompare != 0) return tierCompare;
      return a.display.compareTo(b.display);
    });
  }
  final entries = map.entries.toList();
  entries.sort((a, b) {
    final ai = brandOrder.indexOf(a.key);
    final bi = brandOrder.indexOf(b.key);
    if (ai == -1 && bi == -1) return a.key.compareTo(b.key);
    if (ai == -1) return 1;
    if (bi == -1) return -1;
    return ai.compareTo(bi);
  });
  return entries;
}

int _tierRank(String tier) {
  const order = [
    'FREE',
    'UNCENSORED',
    'PICO',
    'NANO',
    'MINI',
    'NORMAL',
    'PRICE',
    'EXPERT',
    'PRO',
  ];
  final index = order.indexOf(tier);
  return index == -1 ? 999 : index;
}

class ComposerBox extends StatefulWidget {
  const ComposerBox({
    super.key,
    required this.busy,
    required this.onSend,
    this.selectedModel,
    this.onOpenModels,
    this.parallelCount = 0,
    this.onOpenParallel,
    this.onOpenImageGen,
    this.onPickImage,
    this.autoMode = false,
    this.routing = false,
  });
  final bool busy;
  final void Function(String text, List<DeltAttachment> attachments) onSend;
  final DeltModel? selectedModel;
  final VoidCallback? onOpenModels;
  final int parallelCount;
  final VoidCallback? onOpenParallel;
  final VoidCallback? onOpenImageGen;

  /// Retourne une attachement ajoutée (ou null si annulé/erreur).
  /// Si null, le bouton attach n'est pas affiché.
  final Future<DeltAttachment?> Function({required ImageSource source})?
      onPickImage;
  final bool autoMode;
  final bool routing;

  @override
  State<ComposerBox> createState() => _ComposerBoxState();
}

class _ComposerBoxState extends State<ComposerBox> {
  final _controller = TextEditingController();
  final _attachments = <DeltAttachment>[];
  bool _picking = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _send() {
    final text = _controller.text.trim();
    if ((text.isEmpty && _attachments.isEmpty) || widget.busy) return;
    final atts = List<DeltAttachment>.from(_attachments);
    _controller.clear();
    setState(_attachments.clear);
    widget.onSend(text, atts);
  }

  Future<void> _onAttachTap() async {
    if (widget.onPickImage == null || _picking) return;
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: DeltColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 8),
            ListTile(
              leading: const Icon(Icons.photo_camera_rounded),
              title: const Text(
                'Prendre une photo',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_rounded),
              title: const Text(
                'Choisir dans la galerie',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
            const SizedBox(height: 6),
          ],
        ),
      ),
    );
    if (source == null) return;
    setState(() => _picking = true);
    try {
      final att = await widget.onPickImage!(source: source);
      if (att != null && mounted) {
        setState(() => _attachments.add(att));
      }
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final model = widget.selectedModel;
    // Espace système en bas (gesture bar Android, home indicator iOS)
    // paddingOf renvoie 0 quand le clavier est ouvert (déjà géré par Scaffold)
    // et la hauteur de la gesture bar quand fermé.
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return Container(
      margin: EdgeInsets.fromLTRB(12, 8, 12, 12 + bottomInset),
      padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: DeltColors.border),
        borderRadius: BorderRadius.circular(24),
        boxShadow: const [
          BoxShadow(
            color: Color(0x12000000),
            blurRadius: 20,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if ((model != null || widget.autoMode) && widget.onOpenModels != null) ...[
            Align(
              alignment: Alignment.centerLeft,
              child: Material(
                color: DeltColors.surface,
                shape: StadiumBorder(
                  side: BorderSide(color: DeltColors.border),
                ),
                child: InkWell(
                  onTap: widget.onOpenModels,
                  customBorder: const StadiumBorder(),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(9, 6, 10, 6),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (widget.autoMode)
                          const Icon(
                            Icons.auto_awesome_rounded,
                            size: 18,
                            color: DeltColors.accent,
                          )
                        else
                          BrandIcon(brand: model!.brand, size: 18),
                        const SizedBox(width: 7),
                        ConstrainedBox(
                          constraints: BoxConstraints(
                            maxWidth: MediaQuery.sizeOf(context).width * .52,
                          ),
                          child: Text(
                            widget.autoMode
                                ? (widget.routing ? 'Auto · triage...' : 'Auto')
                                : model!.display,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        const SizedBox(width: 7),
                        const Icon(
                          Icons.expand_more_rounded,
                          size: 17,
                          color: DeltColors.muted,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 4),
          ],
          if (_attachments.isNotEmpty) ...[
            SizedBox(
              height: 64,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(2, 4, 2, 6),
                itemCount: _attachments.length,
                separatorBuilder: (_, __) => const SizedBox(width: 6),
                itemBuilder: (_, i) => _AttachmentChip(
                  attachment: _attachments[i],
                  onRemove: () => setState(() => _attachments.removeAt(i)),
                ),
              ),
            ),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (widget.onPickImage != null) ...[
                IconButton(
                  onPressed: widget.busy || _picking ? null : _onAttachTap,
                  style: IconButton.styleFrom(
                    backgroundColor: DeltColors.surface,
                    foregroundColor: DeltColors.muted,
                    minimumSize: const Size(38, 38),
                  ),
                  icon: _picking
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.add_rounded, size: 22),
                  tooltip: 'Ajouter une image',
                ),
                const SizedBox(width: 4),
              ],
              Expanded(
                child: TextField(
                  controller: _controller,
                  minLines: 1,
                  maxLines: 5,
                  decoration: const InputDecoration(
                    hintText: 'Posez votre question',
                    filled: false,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              if (widget.onOpenImageGen != null) ...[
                IconButton(
                  onPressed: widget.busy ? null : widget.onOpenImageGen,
                  style: IconButton.styleFrom(
                    backgroundColor: const Color(0xFFFCE7F3),
                    foregroundColor: const Color(0xFFEC4899),
                    minimumSize: const Size(42, 42),
                  ),
                  icon: const Icon(Icons.image_rounded, size: 20),
                  tooltip: 'Générer une image',
                ),
                const SizedBox(width: 6),
              ],
              if (widget.onOpenParallel != null) ...[
                IconButton(
                  onPressed: widget.busy ? null : widget.onOpenParallel,
                  style: IconButton.styleFrom(
                    backgroundColor: widget.parallelCount >= 2
                        ? DeltColors.accent
                        : DeltColors.surface,
                    foregroundColor: widget.parallelCount >= 2
                        ? Colors.white
                        : DeltColors.muted,
                    minimumSize: const Size(42, 42),
                  ),
                  icon: widget.parallelCount >= 2
                      ? Text(
                          '×${widget.parallelCount}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w900,
                          ),
                        )
                      : const Icon(Icons.grid_view_rounded, size: 19),
                ),
                const SizedBox(width: 6),
              ],
              FilledButton(
                onPressed: widget.busy ? null : _send,
                style: FilledButton.styleFrom(
                  backgroundColor: DeltColors.text,
                  minimumSize: const Size(42, 42),
                  padding: EdgeInsets.zero,
                  shape: const CircleBorder(),
                ),
                child: widget.busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(
                        Icons.arrow_upward_rounded,
                        color: Colors.white,
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AttachmentChip extends StatelessWidget {
  const _AttachmentChip({required this.attachment, required this.onRemove});
  final DeltAttachment attachment;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final isImage = attachment.kind == 'image' && attachment.url != null;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: DeltColors.surface,
            border: Border.all(color: DeltColors.border),
            borderRadius: BorderRadius.circular(12),
          ),
          clipBehavior: Clip.antiAlias,
          child: isImage
              ? Image.network(
                  attachment.url!,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const Center(
                    child: Icon(
                      Icons.broken_image_outlined,
                      size: 22,
                      color: DeltColors.muted,
                    ),
                  ),
                )
              : Center(
                  child: Icon(
                    _iconFor(attachment.kind),
                    color: DeltColors.muted,
                    size: 22,
                  ),
                ),
        ),
        Positioned(
          top: -6,
          right: -6,
          child: Material(
            color: DeltColors.text,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onRemove,
              child: const Padding(
                padding: EdgeInsets.all(3),
                child: Icon(Icons.close_rounded, color: Colors.white, size: 13),
              ),
            ),
          ),
        ),
      ],
    );
  }

  static IconData _iconFor(String kind) {
    switch (kind) {
      case 'pdf':
        return Icons.picture_as_pdf_rounded;
      case 'text':
        return Icons.text_snippet_rounded;
      default:
        return Icons.insert_drive_file_rounded;
    }
  }
}

class MessageModelHeader extends StatelessWidget {
  const MessageModelHeader({super.key, required this.model});
  final Map<String, dynamic> model;

  @override
  Widget build(BuildContext context) {
    final brand = '${model['brand'] ?? 'AI'}';
    final display = '${model['display'] ?? model['id'] ?? 'Modèle'}';
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          BrandIcon(brand: brand, size: 16),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              display,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: DeltColors.muted,
                fontSize: 11,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
