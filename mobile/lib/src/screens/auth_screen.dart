import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../api/deltai_api.dart';
import '../config/app_config.dart';
import '../models/models.dart';
import '../theme/delt_theme.dart';
import '../widgets/delt_components.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.api, required this.onAuth});
  final DeltaIApi api;
  final ValueChanged<DeltUser> onAuth;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _register = false;
  bool _busy = false;
  bool _legalAccepted = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_register && !_legalAccepted) {
      setState(() {
        _error = 'Tu dois accepter les CGU et la politique de confidentialité.';
      });
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final user = _register
          ? await widget.api.register(_email.text.trim(), _password.text)
          : await widget.api.login(_email.text.trim(), _password.text);
      widget.onAuth(user);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _google() async {
    if (!_legalAccepted) {
      setState(() {
        _error = 'Tu dois accepter les CGU et la politique de confidentialité.';
      });
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final googleSignIn = GoogleSignIn(
        clientId: defaultTargetPlatform == TargetPlatform.iOS
            ? AppConfig.googleMobileClientId
            : null,
        serverClientId: AppConfig.googleWebClientId,
      );
      debugPrint('Google sign-in: starting native sign-in');
      await googleSignIn.signOut();
      final googleUser = await googleSignIn.signIn();
      if (googleUser == null) {
        throw Exception('Connexion Google annulée.');
      }
      debugPrint('Google sign-in: account selected');
      final googleAuth = await googleUser.authentication;
      final idToken = googleAuth.idToken;
      if (idToken == null) {
        throw Exception('Google n’a pas renvoyé de token.');
      }

      debugPrint('Google sign-in: signing in with Supabase');
      final supabaseAuth = await Supabase.instance.client.auth
          .signInWithIdToken(
            provider: OAuthProvider.google,
            idToken: idToken,
            accessToken: googleAuth.accessToken,
          );
      final session = supabaseAuth.session;
      if (session == null) {
        throw Exception('Session Supabase introuvable.');
      }

      final user = await widget.api.googleAuth(
        session.accessToken,
        legalAccepted: _legalAccepted,
      );
      widget.onAuth(user);
    } on PlatformException catch (e) {
      debugPrint(
        'Google sign-in PlatformException: '
        'code=${e.code}, message=${e.message}, details=${e.details}',
      );
      setState(() {
        _error =
            'Erreur Google (${e.code}) : ${e.message ?? e.details ?? 'détails indisponibles'}';
      });
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 48, 20, 20),
          children: [
            const Center(child: DeltLogo(size: 120, showText: true)),
            const SizedBox(height: 8),
            const Text(
              'Le même chat IA que le site, optimisé mobile.',
              textAlign: TextAlign.center,
              style: TextStyle(color: DeltColors.muted, fontSize: 15),
            ),
            const SizedBox(height: 34),
            OutlinedButton.icon(
              onPressed: _busy ? null : _google,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                side: const BorderSide(color: DeltColors.border),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
                foregroundColor: DeltColors.text,
              ),
              icon: const Icon(Icons.g_mobiledata_rounded, size: 30),
              label: const Text(
                'Continuer avec Google',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: const [
                Expanded(child: Divider(color: DeltColors.border)),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  child: Text('ou', style: TextStyle(color: DeltColors.muted)),
                ),
                Expanded(child: Divider(color: DeltColors.border)),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Mot de passe'),
            ),
            const SizedBox(height: 8),
            CheckboxListTile(
              value: _legalAccepted,
              onChanged: _busy
                  ? null
                  : (v) => setState(() => _legalAccepted = v ?? false),
              dense: true,
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text(
                'J’accepte les CGU et la politique de confidentialité.',
                style: TextStyle(fontSize: 12, color: DeltColors.muted),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: const TextStyle(
                  color: Colors.red,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _busy ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: DeltColors.text,
                minimumSize: const Size.fromHeight(52),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
              ),
              child: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : Text(_register ? 'Créer mon compte' : 'Connexion'),
            ),
            TextButton(
              onPressed: _busy
                  ? null
                  : () => setState(() => _register = !_register),
              child: Text(
                _register ? 'J’ai déjà un compte' : 'Créer un compte',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
