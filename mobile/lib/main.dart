import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'core/api_client.dart';
import 'core/auth_provider.dart';
import 'core/theme.dart';
import 'features/shell/app_shell.dart';
import 'services/api_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: CrickTheme.bgElevated,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const CrickridaApp());
}

class CrickridaApp extends StatelessWidget {
  const CrickridaApp({super.key});

  @override
  Widget build(BuildContext context) {
    final apiClient = ApiClient();
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: apiClient),
        Provider<ApiService>(create: (_) => ApiService(apiClient)),
        ChangeNotifierProvider<AuthProvider>(
          create: (_) => AuthProvider(apiClient),
        ),
      ],
      child: MaterialApp(
        title: 'Crickrida',
        debugShowCheckedModeBanner: false,
        theme: CrickTheme.dark,
        home: const _Root(),
      ),
    );
  }
}

class _Root extends StatelessWidget {
  const _Root();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (auth.loading) {
      return const Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image(
                image: AssetImage('assets/branding/splash-logo.png'),
                width: 104,
                height: 104,
              ),
              SizedBox(height: 12),
              Text(
                'Crickrida',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  color: CrickTheme.cyan,
                  letterSpacing: 0.5,
                ),
              ),
              SizedBox(height: 18),
              SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: CrickTheme.cyan,
                ),
              ),
            ],
          ),
        ),
      );
    }
    return const AppShell();
  }
}
