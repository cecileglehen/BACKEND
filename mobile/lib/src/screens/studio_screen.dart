import 'package:flutter/material.dart';

import '../api/deltai_api.dart';
import '../models/models.dart';
import '../theme/delt_theme.dart';
import '../widgets/delt_ui.dart';

class StudioScreen extends StatefulWidget {
  const StudioScreen({super.key, required this.api});
  final DeltaIApi api;

  @override
  State<StudioScreen> createState() => _StudioScreenState();
}

class _StudioScreenState extends State<StudioScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab = TabController(length: 3, vsync: this);

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Studio créatif'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        bottom: TabBar(
          controller: _tab,
          labelColor: DeltColors.text,
          unselectedLabelColor: DeltColors.muted,
          indicatorColor: DeltColors.accent,
          indicatorWeight: 2.5,
          labelStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13),
          tabs: const [
            Tab(icon: Icon(Icons.image_outlined), text: 'Image'),
            Tab(icon: Icon(Icons.movie_creation_outlined), text: 'Vidéo'),
            Tab(icon: Icon(Icons.music_note_outlined), text: 'Musique'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tab,
        children: [
          _ImageTab(api: widget.api),
          _VideoTab(api: widget.api),
          _MusicTab(api: widget.api),
        ],
      ),
    );
  }
}

// ─── IMAGE ──────────────────────────────────────────────────────────────────
class _ImageTab extends StatefulWidget {
  const _ImageTab({required this.api});
  final DeltaIApi api;

  @override
  State<_ImageTab> createState() => _ImageTabState();
}

class _ImageTabState extends State<_ImageTab> {
  final _prompt = TextEditingController();
  final _models = <DeltImageModel>[];
  DeltImageModel? _selected;
  bool _busy = false;
  String? _resultUrl;
  String? _resultPrompt;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _prompt.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await widget.api.imageModels();
      if (!mounted) return;
      setState(() {
        _models
          ..clear()
          ..addAll(list);
        _selected = list.isNotEmpty ? list.first : null;
      });
    } on DeltApiException catch (e) {
      if (mounted) DeltUI.error(context, e.message);
    }
  }

  Future<void> _generate() async {
    final p = _prompt.text.trim();
    if (p.isEmpty || _selected == null) return;
    setState(() {
      _busy = true;
      _resultUrl = null;
    });
    try {
      final result = await widget.api.generateImage(
        prompt: p,
        modelId: _selected!.id,
      );
      if (!mounted) return;
      setState(() {
        _resultUrl = result['url']?.toString();
        _resultPrompt = p;
      });
    } on DeltApiException catch (e) {
      if (mounted) DeltUI.error(context, e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _ModelChips<DeltImageModel>(
          models: _models,
          selected: _selected,
          getId: (m) => m.id,
          getDisplay: (m) => m.display,
          getCost: (m) => m.cost,
          onSelect: (m) => setState(() => _selected = m),
        ),
        const SizedBox(height: 14),
        _PromptField(
          controller: _prompt,
          hint: 'Décris l\'image que tu veux générer…',
        ),
        const SizedBox(height: 14),
        _GenerateButton(
          busy: _busy,
          enabled: !_busy && _selected != null,
          cost: _selected?.cost,
          label: 'Générer l\'image',
          onPressed: _generate,
        ),
        const SizedBox(height: 18),
        if (_resultUrl != null)
          _ResultCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.network(
                    _resultUrl!,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const Padding(
                      padding: EdgeInsets.all(40),
                      child: Icon(Icons.broken_image_outlined,
                          color: DeltColors.muted),
                    ),
                  ),
                ),
                if (_resultPrompt != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _resultPrompt!,
                    style: const TextStyle(
                      color: DeltColors.muted,
                      fontStyle: FontStyle.italic,
                      fontSize: 12,
                    ),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

// ─── VIDÉO ──────────────────────────────────────────────────────────────────
class _VideoTab extends StatefulWidget {
  const _VideoTab({required this.api});
  final DeltaIApi api;

  @override
  State<_VideoTab> createState() => _VideoTabState();
}

class _VideoTabState extends State<_VideoTab> {
  final _prompt = TextEditingController();
  final _models = <DeltVideoModel>[];
  DeltVideoModel? _selected;
  int _duration = 5;
  bool _busy = false;
  String? _resultUrl;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _prompt.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await widget.api.videoModels();
      if (!mounted) return;
      setState(() {
        _models
          ..clear()
          ..addAll(list);
        _selected = list.isNotEmpty ? list.first : null;
      });
    } on DeltApiException catch (e) {
      if (mounted) DeltUI.error(context, e.message);
    }
  }

  Future<void> _generate() async {
    final p = _prompt.text.trim();
    if (p.isEmpty || _selected == null) return;
    setState(() {
      _busy = true;
      _resultUrl = null;
    });
    try {
      final result = await widget.api.generateVideo(
        prompt: p,
        modelId: _selected!.id,
        duration: _duration,
      );
      if (!mounted) return;
      setState(() => _resultUrl = result['url']?.toString());
      DeltUI.success(context, 'Vidéo générée !');
    } on DeltApiException catch (e) {
      if (mounted) DeltUI.error(context, e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  num? get _estimatedCost {
    if (_selected == null) return null;
    return (_selected!.crPerSecond720p * _duration).ceil();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _ModelChips<DeltVideoModel>(
          models: _models,
          selected: _selected,
          getId: (m) => m.id,
          getDisplay: (m) => m.display,
          getCost: (m) => m.crPerSecond720p,
          costSuffix: '/s',
          onSelect: (m) => setState(() => _selected = m),
        ),
        const SizedBox(height: 14),
        _PromptField(
          controller: _prompt,
          hint: 'Décris la scène vidéo (720p, ${_duration}s)…',
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: DeltColors.border),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              const Icon(Icons.timer_outlined, color: DeltColors.muted, size: 18),
              const SizedBox(width: 8),
              Text(
                'Durée : ${_duration}s',
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
              ),
              Expanded(
                child: Slider(
                  value: _duration.toDouble(),
                  min: 1,
                  max: 10,
                  divisions: 9,
                  activeColor: DeltColors.accent,
                  onChanged: (v) => setState(() => _duration = v.round()),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        _GenerateButton(
          busy: _busy,
          enabled: !_busy && _selected != null,
          cost: _estimatedCost,
          label: 'Générer la vidéo',
          onPressed: _generate,
        ),
        const SizedBox(height: 18),
        if (_resultUrl != null)
          _ResultCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: const [
                    Icon(Icons.check_circle, color: Color(0xFF10B981), size: 20),
                    SizedBox(width: 8),
                    Text(
                      'Vidéo prête',
                      style: TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                SelectableText(
                  _resultUrl!,
                  style: const TextStyle(
                    color: DeltColors.accent,
                    fontSize: 12,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

// ─── MUSIQUE ────────────────────────────────────────────────────────────────
class _MusicTab extends StatefulWidget {
  const _MusicTab({required this.api});
  final DeltaIApi api;

  @override
  State<_MusicTab> createState() => _MusicTabState();
}

class _MusicTabState extends State<_MusicTab> {
  final _prompt = TextEditingController();
  final _style = TextEditingController(text: 'Pop');
  final _models = <DeltMusicModel>[];
  DeltMusicModel? _selected;
  bool _instrumental = false;
  bool _busy = false;
  List<DeltMusicTrack>? _tracks;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _prompt.dispose();
    _style.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await widget.api.musicModels();
      if (!mounted) return;
      setState(() {
        _models
          ..clear()
          ..addAll(list);
        _selected = list.isNotEmpty ? list.first : null;
      });
    } on DeltApiException catch (e) {
      if (mounted) DeltUI.error(context, e.message);
    }
  }

  Future<void> _generate() async {
    final p = _prompt.text.trim();
    if (p.isEmpty) return;
    setState(() {
      _busy = true;
      _tracks = null;
    });
    try {
      final result = await widget.api.generateMusic(
        prompt: p,
        style: _style.text.trim().isEmpty ? 'Pop' : _style.text.trim(),
        instrumental: _instrumental,
      );
      if (!mounted) return;
      final list = (result['tracks'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(DeltMusicTrack.fromJson)
          .toList();
      setState(() => _tracks = list);
      DeltUI.success(context, '${list.length} pistes générées !');
    } on DeltApiException catch (e) {
      if (mounted) DeltUI.error(context, e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _ModelChips<DeltMusicModel>(
          models: _models,
          selected: _selected,
          getId: (m) => m.id,
          getDisplay: (m) => m.display,
          getCost: (m) => m.cost,
          onSelect: (m) => setState(() => _selected = m),
        ),
        const SizedBox(height: 14),
        _PromptField(
          controller: _prompt,
          hint: 'Décris l\'ambiance, paroles, vibe…',
          maxLines: 4,
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _style,
          decoration: const InputDecoration(
            labelText: 'Style musical',
            hintText: 'Pop, Rock, Hip-Hop, Jazz…',
          ),
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _instrumental,
          onChanged: (v) => setState(() => _instrumental = v),
          title: const Text(
            'Instrumental (pas de paroles)',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
          ),
          activeThumbColor: DeltColors.accent,
        ),
        const SizedBox(height: 6),
        _GenerateButton(
          busy: _busy,
          enabled: !_busy,
          cost: _selected?.cost,
          label: 'Générer (2 pistes)',
          onPressed: _generate,
        ),
        const SizedBox(height: 18),
        if (_tracks != null && _tracks!.isNotEmpty)
          _ResultCard(
            child: Column(
              children: [
                for (final t in _tracks!) ...[
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF8B5CF6), Color(0xFFEC4899)],
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.music_note_rounded,
                        color: Colors.white,
                        size: 18,
                      ),
                    ),
                    title: Text(
                      t.title ?? 'Piste',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    subtitle: Text(
                      t.duration != null
                          ? '${t.duration!.toStringAsFixed(0)}s'
                          : 'Audio',
                      style: const TextStyle(fontSize: 11, color: DeltColors.muted),
                    ),
                    trailing: const Icon(Icons.open_in_new, size: 18),
                    onTap: () {
                      // L'utilisateur peut copier l'URL.
                    },
                  ),
                  if (t != _tracks!.last) const Divider(height: 1),
                ],
                const SizedBox(height: 8),
                const Text(
                  'Les fichiers audio sont accessibles via leur URL (long-press pour copier).',
                  style: TextStyle(color: DeltColors.muted, fontSize: 11),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

// ─── Composants partagés ────────────────────────────────────────────────────
class _ModelChips<T> extends StatelessWidget {
  const _ModelChips({
    required this.models,
    required this.selected,
    required this.getId,
    required this.getDisplay,
    required this.getCost,
    required this.onSelect,
    this.costSuffix,
  });
  final List<T> models;
  final T? selected;
  final String Function(T) getId;
  final String Function(T) getDisplay;
  final num Function(T) getCost;
  final String? costSuffix;
  final ValueChanged<T> onSelect;

  @override
  Widget build(BuildContext context) {
    if (models.isEmpty) {
      return const DeltSkeleton(height: 38, radius: 10);
    }
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final m in models) ...[
            _Chip(
              label: getDisplay(m),
              cost: getCost(m),
              suffix: costSuffix,
              selected: selected != null && getId(selected as T) == getId(m),
              onTap: () => onSelect(m),
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.cost,
    required this.selected,
    required this.onTap,
    this.suffix,
  });
  final String label;
  final num cost;
  final bool selected;
  final String? suffix;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? DeltColors.text : Colors.white,
          border: Border.all(
            color: selected ? DeltColors.text : DeltColors.border,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Text(
              label,
              style: TextStyle(
                color: selected ? Colors.white : DeltColors.text,
                fontWeight: FontWeight.w800,
                fontSize: 13,
              ),
            ),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: selected
                    ? Colors.white.withValues(alpha: .15)
                    : DeltColors.surface,
                borderRadius: BorderRadius.circular(5),
              ),
              child: Text(
                '${cost.toStringAsFixed(cost % 1 == 0 ? 0 : 1)}${suffix ?? ''} Cr',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  color: selected ? Colors.white : DeltColors.muted,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PromptField extends StatelessWidget {
  const _PromptField({
    required this.controller,
    required this.hint,
    this.maxLines = 5,
  });
  final TextEditingController controller;
  final String hint;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      minLines: 3,
      maxLines: maxLines,
      maxLength: 4000,
      textInputAction: TextInputAction.newline,
      decoration: InputDecoration(hintText: hint),
    );
  }
}

class _GenerateButton extends StatelessWidget {
  const _GenerateButton({
    required this.busy,
    required this.enabled,
    required this.label,
    required this.onPressed,
    this.cost,
  });
  final bool busy;
  final bool enabled;
  final String label;
  final num? cost;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton.icon(
      onPressed: enabled ? onPressed : null,
      style: FilledButton.styleFrom(
        backgroundColor: DeltColors.text,
        minimumSize: const Size.fromHeight(54),
      ),
      icon: busy
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            )
          : const Icon(Icons.auto_awesome_rounded),
      label: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(busy ? 'Génération...' : label),
          if (cost != null && !busy) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: .15),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                '${cost!.toStringAsFixed(cost! % 1 == 0 ? 0 : 1)} Cr',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: DeltColors.border),
        borderRadius: BorderRadius.circular(18),
      ),
      child: child,
    );
  }
}
