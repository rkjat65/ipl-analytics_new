import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/auth_provider.dart';
import '../../core/theme.dart';
import '../../widgets/widgets.dart';
import '../auth/login_screen.dart';
import '../charts/charts_screen.dart';
import '../h2h/h2h_screen.dart';
import '../impact/impact_screen.dart';
import '../pulse/pulse_screen.dart';
import '../seasons/seasons_screen.dart';
import '../social/social_screen.dart';
import '../studio/content_studio_screen.dart';
import '../teams/teams_screen.dart';
import '../venues/venues_screen.dart';
import '../ask/ask_screen.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('More')),
      body: ListView(
        children: [
          CrickCard(
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: CrickTheme.cyan.withValues(alpha: 0.15),
                  child: Text(
                    auth.isAuthenticated && auth.displayName.isNotEmpty
                        ? auth.displayName[0].toUpperCase()
                        : '?',
                    style: GoogleFonts.spaceGrotesk(fontSize: 22, fontWeight: FontWeight.w700, color: CrickTheme.cyan),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        auth.isAuthenticated ? auth.displayName : 'Guest',
                        style: GoogleFonts.spaceGrotesk(fontSize: 18, fontWeight: FontWeight.w700),
                      ),
                      Text(
                        auth.isAuthenticated ? '${auth.user?['email'] ?? ''} · ${auth.plan}' : 'Browse freely · sign in for AI',
                        style: const TextStyle(color: CrickTheme.textSecondary, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                if (auth.isAuthenticated)
                  TextButton(onPressed: () => auth.logout(), child: const Text('Logout'))
                else
                  FilledButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                    ),
                    child: const Text('Sign in'),
                  ),
              ],
            ),
          ),
          const SectionHeader('Explore'),
          _tile(context, Icons.auto_awesome, 'Ask Cricket', const AskScreen(), CrickTheme.cyan),
          _tile(context, Icons.dashboard_customize_rounded, 'Content Studio', const ContentStudioScreen(), CrickTheme.lime),
          _tile(context, Icons.bolt_rounded, 'Cricket Pulse', const PulseScreen(), CrickTheme.amber),
          _tile(context, Icons.groups_rounded, 'Teams', const TeamsScreen(), CrickTheme.magenta),
          _tile(context, Icons.stadium_outlined, 'Venues', const VenuesScreen(), CrickTheme.purple),
          _tile(context, Icons.calendar_month_rounded, 'Seasons', const SeasonsScreen(), CrickTheme.cyan),
          _tile(context, Icons.sports_kabaddi_rounded, 'Head to Head', const H2HScreen(), CrickTheme.lime),
          _tile(context, Icons.bar_chart_rounded, 'Charts', const ChartsScreen(), CrickTheme.amber),
          _tile(context, Icons.insights_rounded, 'Player Impact', const ImpactScreen(), CrickTheme.magenta),
          _tile(context, Icons.share_rounded, 'Social Compose', const SocialScreen(), CrickTheme.cyan),
          const SectionHeader('Links'),
          CrickCard(
            onTap: () => launchUrl(Uri.parse('https://crickrida.rkjat.in'), mode: LaunchMode.externalApplication),
            child: const Row(
              children: [
                Icon(Icons.open_in_new, color: CrickTheme.cyan),
                SizedBox(width: 12),
                Expanded(child: Text('Open web dashboard')),
                Icon(Icons.chevron_right, color: CrickTheme.textMuted),
              ],
            ),
          ),
          CrickCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Crickrida Mobile', style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                const Text(
                  'Full IPL analytics client powered by the same FastAPI backend as crickrida.rkjat.in',
                  style: TextStyle(color: CrickTheme.textSecondary, fontSize: 12, height: 1.35),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
        ],
      ),
    );
  }

  Widget _tile(BuildContext context, IconData icon, String title, Widget page, Color color) {
    return CrickCard(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => page)),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w600))),
          const Icon(Icons.chevron_right, color: CrickTheme.textMuted),
        ],
      ),
    );
  }
}
