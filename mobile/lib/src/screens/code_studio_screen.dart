import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../api/deltai_api.dart';
import '../models/models.dart';
import '../theme/delt_theme.dart';
import '../widgets/delt_ui.dart';

/// Code Studio : génération + édition itérative + preview WebView.
class CodeStudioScreen extends StatefulWidget {
  const CodeStudioScreen({super.key, required this.api});
  final DeltaIApi api;

  @override
  State<CodeStudioScreen> createState() => _CodeStudioScreenState();
}

class _CodeStudioScreenState extends State<CodeStudioScreen> {
  final _prompt = TextEditingController();
  final _focus = FocusNode();
  final _history = <_CodeTurn>[];
  DeltCodeSession? _session;
  bool _busy = false;
  late final WebViewController _web;
  bool _previewReady = false;

  @override
  void initState() {
    super.initState();
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) => setState(() => _previewReady = true),
        ),
      );
  }

  @override
  void dispose() {
    _prompt.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final p = _prompt.text.trim();
    if (p.isEmpty || _busy) return;
    _focus.unfocus();
    setState(() {
      _busy = true;
      _history.add(_CodeTurn(prompt: p, isEdit: _session != null));
      _prompt.clear();
    });

    try {
      final result = _session == null
          ? await widget.api.codeSession(prompt: p)
          : await widget.api.codeEdit(sessionId: _session!.id, prompt: p);

      if (!mounted) return;
      setState(() {
        _session = result;
        _history.last = _history.last.copyWith(
          fileCount: result.files.length,
          done: true,
        );
        _previewReady = false;
      });
      _loadPreview();
    } on DeltApiException catch (e) {
      if (!mounted) return;
      setState(() => _history.last = _history.last.copyWith(
            error: e.message,
            done: true,
          ));
      DeltUI.error(context, e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _loadPreview() {
    if (_session == null) return;
    final url = widget.api.codePreviewUrl(_session!.id);
    _web.loadRequest(Uri.parse(url));
  }

  Future<void> _copyShareLink() async {
    if (_session == null) return;
    final url = widget.api.codePreviewUrl(_session!.id);
    await Clipboard.setData(ClipboardData(text: url));
    if (!mounted) return;
    DeltUI.success(context, 'Lien preview copié');
  }

  Future<void> _newSession() async {
    if (_session == null) return;
    final ok = await DeltUI.confirm(
      context,
      title: 'Nouveau projet ?',
      message: 'La session actuelle sera abandonnée.',
      confirmLabel: 'Démarrer',
    );
    if (!ok) return;
    setState(() {
      _session = null;
      _history.clear();
      _previewReady = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Code Studio'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        actions: [
          if (_session != null)
            IconButton(
              tooltip: 'Copier le lien',
              onPressed: _copyShareLink,
              icon: const Icon(Icons.link_rounded),
            ),
          if (_session != null)
            IconButton(
              tooltip: 'Nouveau projet',
              onPressed: _busy ? null : _newSession,
              icon: const Icon(Icons.refresh_rounded),
            ),
        ],
      ),
      body: Column(
        children: [
          // Preview ou welcome
          Expanded(
            child: _session == null ? _buildWelcome() : _buildPreview(),
          ),
          // Historique compact (fil)
          if (_history.isNotEmpty) _buildHistoryStrip(),
          // Composer code
          _buildComposer(),
        ],
      ),
    );
  }

  Widget _buildWelcome() {
    return DeltEmptyState(
      icon: Icons.code_rounded,
      title: _busy ? 'Génération en cours...' : 'Crée ton app web',
      subtitle: _busy
          ? null
          : 'Décris ce que tu veux : une landing page, un calculateur, un mini-jeu, un tableau de bord… Tu pourras itérer ensuite.',
      action: _busy
          ? const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : null,
    );
  }

  Widget _buildPreview() {
    return Stack(
      children: [
        Container(
          margin: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: DeltColors.border),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: .04),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              // Faux barre de navigateur
              Container(
                height: 30,
                color: const Color(0xFFF8FAFC),
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Row(
                  children: [
                    for (final c in const [
                      Color(0xFFEF4444),
                      Color(0xFFF59E0B),
                      Color(0xFF10B981),
                    ]) ...[
                      Container(
                        width: 9,
                        height: 9,
                        decoration: BoxDecoration(
                          color: c,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                    ],
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        '${_session?.files.length ?? 0} fichier(s) · live',
                        style: const TextStyle(
                          fontSize: 11,
                          color: DeltColors.muted,
                          fontWeight: FontWeight.w700,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(child: WebViewWidget(controller: _web)),
            ],
          ),
        ),
        if (!_previewReady && _session != null)
          const Positioned.fill(
            child: Center(
              child: SizedBox(
                width: 32,
                height: 32,
                child: CircularProgressIndicator(strokeWidth: 2.5),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildHistoryStrip() {
    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: DeltColors.border)),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _history.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final t = _history[i];
          return Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: t.error != null
                    ? const Color(0xFFFEF2F2)
                    : DeltColors.surface,
                border: Border.all(
                  color: t.error != null
                      ? const Color(0xFFFECACA)
                      : DeltColors.border,
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                children: [
                  Icon(
                    t.isEdit ? Icons.edit_rounded : Icons.auto_awesome_rounded,
                    size: 12,
                    color: t.error != null
                        ? const Color(0xFFDC2626)
                        : DeltColors.accent,
                  ),
                  const SizedBox(width: 6),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 140),
                    child: Text(
                      t.prompt,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (!t.done) ...[
                    const SizedBox(width: 6),
                    const SizedBox(
                      width: 11,
                      height: 11,
                      child: CircularProgressIndicator(strokeWidth: 1.5),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildComposer() {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: DeltColors.border)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: _prompt,
                focusNode: _focus,
                minLines: 1,
                maxLines: 5,
                textInputAction: TextInputAction.newline,
                decoration: InputDecoration(
                  hintText: _session == null
                      ? 'Crée une calculatrice de tip avec gradient violet…'
                      : 'Modifie : "ajoute un mode sombre", "agrandis le titre"…',
                  filled: true,
                  fillColor: DeltColors.surface,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(18),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: _busy ? null : _send,
              style: FilledButton.styleFrom(
                backgroundColor: DeltColors.text,
                shape: const CircleBorder(),
                minimumSize: const Size(48, 48),
                padding: EdgeInsets.zero,
              ),
              child: _busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Icon(
                      _session == null
                          ? Icons.auto_awesome_rounded
                          : Icons.send_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CodeTurn {
  const _CodeTurn({
    required this.prompt,
    required this.isEdit,
    this.fileCount = 0,
    this.done = false,
    this.error,
  });
  final String prompt;
  final bool isEdit;
  final int fileCount;
  final bool done;
  final String? error;

  _CodeTurn copyWith({int? fileCount, bool? done, String? error}) => _CodeTurn(
        prompt: prompt,
        isEdit: isEdit,
        fileCount: fileCount ?? this.fileCount,
        done: done ?? this.done,
        error: error ?? this.error,
      );
}
