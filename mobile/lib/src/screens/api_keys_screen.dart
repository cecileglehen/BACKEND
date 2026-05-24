import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/deltai_api.dart';
import '../models/models.dart';
import '../theme/delt_theme.dart';
import '../widgets/delt_ui.dart';

class ApiKeysScreen extends StatefulWidget {
  const ApiKeysScreen({super.key, required this.api});
  final DeltaIApi api;

  @override
  State<ApiKeysScreen> createState() => _ApiKeysScreenState();
}

class _ApiKeysScreenState extends State<ApiKeysScreen> {
  final _keys = <DeltApiKey>[];
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final keys = await widget.api.listApiKeys();
      if (!mounted) return;
      setState(() {
        _keys
          ..clear()
          ..addAll(keys);
      });
    } on DeltApiException catch (e) {
      if (!mounted) return;
      DeltUI.error(context, e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    final name = await DeltUI.prompt(
      context,
      title: 'Nouvelle clé API',
      label: 'Nom (ex: "Mon backend")',
      confirmLabel: 'Créer',
    );
    if (name == null) return;
    setState(() => _busy = true);
    try {
      final key = await widget.api.createApiKey(name: name);
      if (!mounted) return;
      await _showFullKey(key);
      await _load();
    } on DeltApiException catch (e) {
      if (mounted) DeltUI.error(context, e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _showFullKey(DeltApiKey key) async {
    if (key.fullKey == null) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Ta clé API',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '⚠ Copie-la maintenant — elle ne sera plus visible après.',
              style: TextStyle(color: Color(0xFFD97706), fontSize: 12.5),
            ),
            const SizedBox(height: 12),
            SelectableText(
              key.fullKey!,
              style: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 13,
                color: DeltColors.text,
              ),
            ),
          ],
        ),
        actions: [
          TextButton.icon(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: key.fullKey!));
              if (ctx.mounted) DeltUI.success(ctx, 'Clé copiée');
            },
            icon: const Icon(Icons.copy_rounded, size: 18),
            label: const Text('Copier'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: DeltColors.text),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('J\'ai sauvegardé'),
          ),
        ],
      ),
    );
  }

  Future<void> _revoke(DeltApiKey key) async {
    final ok = await DeltUI.confirm(
      context,
      title: 'Révoquer la clé ?',
      message:
          'Cette action est irréversible. Tous les appels avec cette clé seront refusés.',
      confirmLabel: 'Révoquer',
      destructive: true,
    );
    if (!ok) return;
    try {
      await widget.api.revokeApiKey(key.id);
      if (!mounted) return;
      DeltUI.success(context, 'Clé révoquée');
      await _load();
    } on DeltApiException catch (e) {
      if (mounted) DeltUI.error(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Clés API'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _busy ? null : _create,
        backgroundColor: DeltColors.text,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Nouvelle clé'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
          : _keys.isEmpty
              ? DeltEmptyState(
                  icon: Icons.vpn_key_outlined,
                  title: 'Aucune clé API',
                  subtitle:
                      'Crée une clé pour utiliser DeltaAI depuis ton backend, compatible OpenAI SDK.',
                  action: FilledButton.icon(
                    onPressed: _create,
                    style: FilledButton.styleFrom(
                      backgroundColor: DeltColors.text,
                    ),
                    icon: const Icon(Icons.add_rounded),
                    label: const Text('Créer une clé'),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                    itemCount: _keys.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) =>
                        _KeyTile(apiKey: _keys[i], onRevoke: () => _revoke(_keys[i])),
                  ),
                ),
    );
  }
}

class _KeyTile extends StatelessWidget {
  const _KeyTile({required this.apiKey, required this.onRevoke});
  final DeltApiKey apiKey;
  final VoidCallback onRevoke;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: DeltColors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: DeltColors.surface,
              borderRadius: BorderRadius.circular(10),
            ),
            alignment: Alignment.center,
            child: const Icon(Icons.vpn_key_rounded, color: DeltColors.accent),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  apiKey.name ?? 'Sans nom',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(
                  '${apiKey.prefix}…',
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: DeltColors.muted,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onRevoke,
            icon: const Icon(Icons.delete_outline, color: Color(0xFFDC2626)),
            tooltip: 'Révoquer',
          ),
        ],
      ),
    );
  }
}
