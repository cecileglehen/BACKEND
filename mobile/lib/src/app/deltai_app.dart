import 'package:flutter/material.dart';

import '../api/deltai_api.dart';
import '../models/models.dart';
import '../screens/auth_screen.dart';
import '../screens/home_screen.dart';
import '../theme/delt_theme.dart';

class DeltaIApp extends StatefulWidget {
  const DeltaIApp({super.key, required this.api});
  final DeltaIApi api;

  @override
  State<DeltaIApp> createState() => _DeltaIAppState();
}

class _DeltaIAppState extends State<DeltaIApp> {
  DeltUser? _user;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    final user = await widget.api.restore();
    if (!mounted) return;
    setState(() {
      _user = user;
      _ready = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DeltaAI',
      debugShowCheckedModeBanner: false,
      theme: deltTheme(),
      home: !_ready
          ? const _Boot()
          : _user == null
          ? AuthScreen(
              api: widget.api,
              onAuth: (u) => setState(() => _user = u),
            )
          : HomeScreen(
              api: widget.api,
              user: _user!,
              onLogout: () async {
                await widget.api.logout();
                if (mounted) setState(() => _user = null);
              },
            ),
    );
  }
}

class _Boot extends StatelessWidget {
  const _Boot();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator(strokeWidth: 2)),
    );
  }
}
