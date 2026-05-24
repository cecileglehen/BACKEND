import 'package:flutter/material.dart';
import '../api/deltai_api.dart';
import '../models/models.dart';
import '../theme/delt_theme.dart';
import 'delt_components.dart';

/// Affiche un bottom sheet de génération d'image et retourne le résultat
/// {url, prompt, model} ou null si annulé.
Future<Map<String, dynamic>?> showImageGenSheet({
  required BuildContext context,
  required DeltaIApi api,
  String? initialPrompt,
}) async {
  return showModalBottomSheet<Map<String, dynamic>>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (ctx) => _ImageGenSheet(api: api, initialPrompt: initialPrompt),
  );
}

class _ImageGenSheet extends StatefulWidget {
  const _ImageGenSheet({required this.api, this.initialPrompt});
  final DeltaIApi api;
  final String? initialPrompt;

  @override
  State<_ImageGenSheet> createState() => _ImageGenSheetState();
}

class _ImageGenSheetState extends State<_ImageGenSheet> {
  late final TextEditingController _prompt;
  List<DeltImageModel> _models = const [];
  DeltImageModel? _selected;
  bool _loading = true;
  bool _generating = false;
  String? _error;
  String? _resultUrl;

  @override
  void initState() {
    super.initState();
    _prompt = TextEditingController(text: widget.initialPrompt ?? '');
    _load();
  }

  Future<void> _load() async {
    try {
      final models = await widget.api.imageModels();
      if (!mounted) return;
      setState(() {
        _models = models;
        _selected = models.isEmpty ? null : models.first;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  @override
  void dispose() {
    _prompt.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    final text = _prompt.text.trim();
    if (text.isEmpty || _selected == null || _generating) return;
    setState(() {
      _generating = true;
      _error = null;
      _resultUrl = null;
    });
    try {
      final r = await widget.api.generateImage(
        prompt: text,
        modelId: _selected!.id,
      );
      if (!mounted) return;
      final url = r['url']?.toString();
      if (url == null || url.isEmpty) {
        throw Exception('URL manquante dans la réponse');
      }
      setState(() {
        _resultUrl = url;
        _generating = false;
      });
      // Renvoie au parent pour ajouter au chat
      if (mounted) {
        Navigator.of(context).pop({
          'url': url,
          'prompt': text,
          'model': {
            'id': _selected!.id,
            'display': _selected!.display,
            'brand': _selected!.brand,
          },
          'cost': r['cost'],
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _generating = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final safeBottom = MediaQuery.paddingOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * .82,
          child: Column(
            children: [
              // Handle
              Container(
                margin: const EdgeInsets.symmetric(vertical: 10),
                width: 40, height: 4,
                decoration: BoxDecoration(
                  color: DeltColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Header
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: Row(
                  children: [
                    Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFEC4899), Color(0xFFF97316)],
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.image_rounded,
                        color: Colors.white, size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Génération d\'image',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          Text(
                            'Décris l\'image, choisis un modèle',
                            style: TextStyle(
                              fontSize: 12,
                              color: DeltColors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
              ),

              const Divider(height: 1, color: DeltColors.border),

              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                        children: [
                          // Prompt
                          const Text(
                            'PROMPT',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.2,
                              color: DeltColors.muted,
                            ),
                          ),
                          const SizedBox(height: 6),
                          TextField(
                            controller: _prompt,
                            minLines: 3,
                            maxLines: 6,
                            maxLength: 2000,
                            decoration: InputDecoration(
                              hintText:
                                  'Ex : un chat astronaute dans l\'espace, style cinéma, lumière chaude…',
                              filled: true,
                              fillColor: DeltColors.surface,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(color: DeltColors.border),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(color: DeltColors.border),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(
                                  color: DeltColors.accent,
                                ),
                              ),
                            ),
                          ),

                          const SizedBox(height: 18),
                          const Text(
                            'MODÈLE',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.2,
                              color: DeltColors.muted,
                            ),
                          ),
                          const SizedBox(height: 8),
                          for (final m in _models) _ModelCard(
                            model: m,
                            selected: _selected?.id == m.id,
                            onTap: () => setState(() => _selected = m),
                          ),

                          if (_error != null) ...[
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFF1F2),
                                border: Border.all(color: const Color(0xFFFECACA)),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                _error!,
                                style: const TextStyle(color: Colors.red),
                              ),
                            ),
                          ],
                        ],
                      ),
              ),

              // Bouton générer
              Container(
                padding: EdgeInsets.fromLTRB(16, 8, 16, 12 + safeBottom),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: DeltColors.border)),
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: (_generating ||
                            _prompt.text.trim().isEmpty ||
                            _selected == null)
                        ? null
                        : _generate,
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      backgroundColor: const Color(0xFFEC4899),
                    ),
                    child: _generating
                        ? Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: const [
                              SizedBox(
                                width: 16, height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              ),
                              SizedBox(width: 10),
                              Text(
                                'Génération…',
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 15,
                                ),
                              ),
                            ],
                          )
                        : Text(
                            'Générer · ${_selected?.cost ?? 0} Cr',
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 15,
                            ),
                          ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ModelCard extends StatelessWidget {
  const _ModelCard({
    required this.model,
    required this.selected,
    required this.onTap,
  });
  final DeltImageModel model;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: selected ? const Color(0xFFFCE7F3) : Colors.white,
            border: Border.all(
              color: selected ? const Color(0xFFEC4899) : DeltColors.border,
              width: selected ? 2 : 1,
            ),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              BrandIcon(brand: model.brand, size: 28),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      model.display,
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        color: selected
                            ? const Color(0xFFEC4899)
                            : DeltColors.text,
                      ),
                    ),
                    if (model.tagline != null && model.tagline!.isNotEmpty)
                      Text(
                        model.tagline!,
                        style: const TextStyle(
                          fontSize: 11,
                          color: DeltColors.muted,
                        ),
                      ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: selected
                      ? const Color(0xFFEC4899)
                      : DeltColors.surface,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${model.cost} Cr',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    color: selected ? Colors.white : DeltColors.muted,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
