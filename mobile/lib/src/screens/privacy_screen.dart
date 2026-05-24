import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/deltai_api.dart';
import '../theme/delt_theme.dart';
import '../widgets/delt_ui.dart';

class PrivacyScreen extends StatefulWidget {
  const PrivacyScreen({
    super.key,
    required this.api,
    required this.onAccountDeleted,
  });
  final DeltaIApi api;
  final VoidCallback onAccountDeleted;

  @override
  State<PrivacyScreen> createState() => _PrivacyScreenState();
}

class _PrivacyScreenState extends State<PrivacyScreen> {
  bool _exporting = false;
  bool _deleting = false;

  Future<void> _export() async {
    setState(() => _exporting = true);
    try {
      final data = await widget.api.exportPrivacyData();
      final pretty = const JsonEncoder.withIndent('  ').convert(data);
      await Clipboard.setData(ClipboardData(text: pretty));
      if (!mounted) return;
      DeltUI.success(
        context,
        'Données exportées (copiées dans le presse-papier)',
      );
    } on DeltApiException catch (e) {
      if (mounted) DeltUI.error(context, e.message);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _delete() async {
    final ok = await DeltUI.confirm(
      context,
      title: 'Supprimer mon compte ?',
      message:
          'Cette action est définitive. Toutes tes conversations, projets et données seront effacés. Tu seras déconnecté immédiatement.',
      confirmLabel: 'Supprimer définitivement',
      destructive: true,
    );
    if (!ok || !mounted) return;

    final confirmText = await DeltUI.prompt(
      context,
      title: 'Confirmation finale',
      label: 'Tape SUPPRIMER pour confirmer',
      confirmLabel: 'Supprimer',
    );
    if (confirmText?.trim().toUpperCase() != 'SUPPRIMER') return;

    setState(() => _deleting = true);
    try {
      await widget.api.deleteAccount();
      if (!mounted) return;
      widget.onAccountDeleted();
      Navigator.of(context).pop();
    } on DeltApiException catch (e) {
      if (mounted) DeltUI.error(context, e.message);
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Confidentialité'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          _Card(
            icon: Icons.download_rounded,
            iconColor: const Color(0xFF6366F1),
            title: 'Exporter mes données',
            subtitle:
                'Téléchargement complet (JSON) : compte, conversations, projets, mémoire, consentements. Conforme RGPD art. 15 & 20.',
            action: FilledButton.icon(
              onPressed: _exporting ? null : _export,
              style: FilledButton.styleFrom(
                backgroundColor: DeltColors.text,
                minimumSize: const Size.fromHeight(46),
              ),
              icon: _exporting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.copy_rounded, size: 18),
              label: Text(_exporting ? 'Export...' : 'Exporter (presse-papier)'),
            ),
          ),
          const SizedBox(height: 14),
          _Card(
            icon: Icons.delete_forever_rounded,
            iconColor: const Color(0xFFDC2626),
            title: 'Supprimer mon compte',
            subtitle:
                'Effacement définitif de toutes tes données conformément au RGPD art. 17. Action irréversible.',
            action: FilledButton.icon(
              onPressed: _deleting ? null : _delete,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                minimumSize: const Size.fromHeight(46),
              ),
              icon: _deleting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.delete_outline, size: 18),
              label:
                  Text(_deleting ? 'Suppression...' : 'Supprimer définitivement'),
            ),
          ),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.action,
  });
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final Widget action;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: DeltColors.border),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: Icon(icon, color: iconColor, size: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            subtitle,
            style: const TextStyle(
              color: DeltColors.muted,
              fontSize: 12.5,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 14),
          action,
        ],
      ),
    );
  }
}
