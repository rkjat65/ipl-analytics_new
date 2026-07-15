import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  bool _register = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final auth = context.read<AuthProvider>();
    try {
      if (_register) {
        await auth.register(_name.text.trim(), _email.text.trim(), _password.text);
      } else {
        await auth.login(_email.text.trim(), _password.text);
      }
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_register ? 'Create account' : 'Sign in')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Crickrida',
            style: GoogleFonts.spaceGrotesk(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: CrickTheme.cyan,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _register ? 'Join for AI, studio exports & more' : 'Access your plan, AI limits & saved work',
            style: const TextStyle(color: CrickTheme.textSecondary),
          ),
          const SizedBox(height: 28),
          if (_register) ...[
            TextField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Name'),
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 12),
          ],
          TextField(
            controller: _email,
            decoration: const InputDecoration(labelText: 'Email'),
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _password,
            decoration: const InputDecoration(labelText: 'Password'),
            obscureText: true,
            onSubmitted: (_) => _submit(),
          ),
          if (_error != null) ...[
            const SizedBox(height: 14),
            Text(_error!, style: const TextStyle(color: CrickTheme.danger, fontSize: 13)),
          ],
          const SizedBox(height: 22),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: _busy
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : Text(_register ? 'Register' : 'Sign in'),
          ),
          TextButton(
            onPressed: _busy
                ? null
                : () => setState(() {
                      _register = !_register;
                      _error = null;
                    }),
            child: Text(
              _register ? 'Already have an account? Sign in' : 'New here? Create account',
              style: const TextStyle(color: CrickTheme.cyan),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Browse analytics freely without signing in. Login unlocks AI, usage tracking and account features.',
            style: TextStyle(color: CrickTheme.textMuted, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
