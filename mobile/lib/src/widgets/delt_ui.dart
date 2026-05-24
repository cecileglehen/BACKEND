import 'package:flutter/material.dart';

import '../theme/delt_theme.dart';

/// Helpers UI réutilisables : toasts, dialogues de confirmation, etc.
class DeltUI {
  DeltUI._();

  // ─── Toasts (SnackBars stylisés) ──────────────────────────────────────────
  static void toast(
    BuildContext context,
    String message, {
    _ToastKind kind = _ToastKind.info,
    Duration duration = const Duration(seconds: 3),
  }) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;
    final palette = _palette(kind);
    messenger
      ..removeCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          duration: duration,
          backgroundColor: Colors.white,
          elevation: 8,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.all(12),
          padding: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: BorderSide(color: palette.border),
          ),
          content: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: palette.iconBg,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Icon(palette.icon, color: palette.iconColor, size: 14),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    message,
                    style: const TextStyle(
                      color: DeltColors.text,
                      fontWeight: FontWeight.w600,
                      fontSize: 13.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
  }

  static void info(BuildContext c, String m) => toast(c, m, kind: _ToastKind.info);
  static void success(BuildContext c, String m) => toast(c, m, kind: _ToastKind.success);
  static void warn(BuildContext c, String m) => toast(c, m, kind: _ToastKind.warn);
  static void error(BuildContext c, String m) => toast(
        c,
        m.replaceFirst('Exception: ', ''),
        kind: _ToastKind.error,
        duration: const Duration(seconds: 5),
      );

  // ─── Dialogue de confirmation ─────────────────────────────────────────────
  static Future<bool> confirm(
    BuildContext context, {
    required String title,
    required String message,
    String confirmLabel = 'Confirmer',
    String cancelLabel = 'Annuler',
    bool destructive = false,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.w900),
        ),
        content: Text(
          message,
          style: const TextStyle(color: DeltColors.muted, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(cancelLabel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: destructive
                  ? const Color(0xFFDC2626)
                  : DeltColors.text,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
    return result == true;
  }

  // ─── Prompt input (TextField simple) ──────────────────────────────────────
  static Future<String?> prompt(
    BuildContext context, {
    required String title,
    String? initialValue,
    String? label,
    String confirmLabel = 'OK',
    int maxLength = 200,
    int maxLines = 1,
  }) async {
    final controller = TextEditingController(text: initialValue ?? '');
    final result = await showDialog<String?>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: maxLength,
          maxLines: maxLines,
          decoration: InputDecoration(labelText: label),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annuler'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: DeltColors.text),
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
    return result;
  }

  // ─── Bouton bottom-sheet d'actions ────────────────────────────────────────
  static Future<T?> actions<T>(
    BuildContext context, {
    String? title,
    required List<DeltAction<T>> actions,
  }) async {
    return showModalBottomSheet<T>(
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
            if (title != null) ...[
              const SizedBox(height: 14),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: DeltColors.muted,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 6),
            ...actions.map(
              (a) => ListTile(
                leading: Icon(
                  a.icon,
                  color: a.destructive
                      ? const Color(0xFFDC2626)
                      : DeltColors.text,
                ),
                title: Text(
                  a.label,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: a.destructive
                        ? const Color(0xFFDC2626)
                        : DeltColors.text,
                  ),
                ),
                subtitle: a.subtitle == null
                    ? null
                    : Text(
                        a.subtitle!,
                        style: const TextStyle(fontSize: 12, color: DeltColors.muted),
                      ),
                onTap: () => Navigator.pop(ctx, a.value),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

/// Action exposée dans un bottom-sheet
class DeltAction<T> {
  const DeltAction({
    required this.label,
    required this.icon,
    required this.value,
    this.subtitle,
    this.destructive = false,
  });
  final String label;
  final IconData icon;
  final T value;
  final String? subtitle;
  final bool destructive;
}

enum _ToastKind { info, success, warn, error }

class _Palette {
  const _Palette({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.border,
  });
  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final Color border;
}

_Palette _palette(_ToastKind kind) {
  switch (kind) {
    case _ToastKind.success:
      return const _Palette(
        icon: Icons.check_rounded,
        iconColor: Colors.white,
        iconBg: Color(0xFF10B981),
        border: Color(0xFFA7F3D0),
      );
    case _ToastKind.warn:
      return const _Palette(
        icon: Icons.warning_amber_rounded,
        iconColor: Colors.white,
        iconBg: Color(0xFFF59E0B),
        border: Color(0xFFFDE68A),
      );
    case _ToastKind.error:
      return const _Palette(
        icon: Icons.close_rounded,
        iconColor: Colors.white,
        iconBg: Color(0xFFDC2626),
        border: Color(0xFFFECACA),
      );
    case _ToastKind.info:
      return const _Palette(
        icon: Icons.info_outline_rounded,
        iconColor: Colors.white,
        iconBg: DeltColors.accent,
        border: Color(0xFFC7D2FE),
      );
  }
}

// ─── Loading shimmer/pulse ───────────────────────────────────────────────────
class DeltSkeleton extends StatefulWidget {
  const DeltSkeleton({
    super.key,
    this.width,
    this.height = 14,
    this.radius = 8,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  State<DeltSkeleton> createState() => _DeltSkeletonState();
}

class _DeltSkeletonState extends State<DeltSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctl;

  @override
  void initState() {
    super.initState();
    _ctl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctl,
      builder: (_, __) => Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(widget.radius),
          color: Color.lerp(
            const Color(0xFFEEF2F7),
            const Color(0xFFE2E8F0),
            _ctl.value,
          ),
        ),
      ),
    );
  }
}

/// État vide stylisé.
class DeltEmptyState extends StatelessWidget {
  const DeltEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.action,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: DeltColors.surface,
                shape: BoxShape.circle,
                border: Border.all(color: DeltColors.border),
              ),
              alignment: Alignment.center,
              child: Icon(icon, color: DeltColors.muted, size: 26),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 15,
              ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: DeltColors.muted,
                  fontSize: 12.5,
                  height: 1.4,
                ),
              ),
            ],
            if (action != null) ...[const SizedBox(height: 18), action!],
          ],
        ),
      ),
    );
  }
}
