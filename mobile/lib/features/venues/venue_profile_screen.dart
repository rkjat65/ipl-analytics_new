import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/formatters.dart';
import '../../services/api_service.dart';
import '../../widgets/widgets.dart';
import '../players/player_profile_screen.dart';

class VenueProfileScreen extends StatefulWidget {
  const VenueProfileScreen({super.key, required this.venueName});
  final String venueName;

  @override
  State<VenueProfileScreen> createState() => _VenueProfileScreenState();
}

class _VenueProfileScreenState extends State<VenueProfileScreen> {
  Map<String, dynamic>? _stats;
  Map<String, dynamic>? _top;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = context.read<ApiService>();
    try {
      final stats = await api.getVenueStats(widget.venueName);
      Map<String, dynamic> top = {};
      try {
        top = await api.getVenueTopPerformers(widget.venueName);
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _stats = stats;
        _top = top;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final batters = asMapList(_top, 'batters').isNotEmpty
        ? asMapList(_top, 'batters')
        : asMapList(_top, 'top_batters');
    final bowlers = asMapList(_top, 'bowlers').isNotEmpty
        ? asMapList(_top, 'bowlers')
        : asMapList(_top, 'top_bowlers');

    return Scaffold(
      appBar: AppBar(title: Text(widget.venueName)),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorView(message: _error!, onRetry: _load)
          : ListView(
              children: [
                CrickCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.venueName,
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      KeyValueRow(
                        'Matches',
                        formatNumber(
                          _stats?['matches'] ?? _stats?['total_matches'],
                        ),
                      ),
                      KeyValueRow(
                        'Avg 1st inns',
                        formatDecimal(
                          _stats?['avg_first_innings'] ?? _stats?['avg_score'],
                        ),
                      ),
                      KeyValueRow(
                        'Avg 2nd inns',
                        formatDecimal(_stats?['avg_second_innings']),
                      ),
                      KeyValueRow(
                        'Chase win %',
                        formatDecimal(
                          _stats?['chase_win_pct'] ??
                              _stats?['chase_percentage'],
                        ),
                      ),
                      KeyValueRow(
                        'Highest total',
                        formatNumber(
                          _stats?['highest_total'] ?? _stats?['highest'],
                        ),
                      ),
                    ],
                  ),
                ),
                if (batters.isNotEmpty) ...[
                  const SectionHeader('Top batters here'),
                  ...batters.take(10).map((p) {
                    final name = (p['player'] ?? p['batter'] ?? '').toString();
                    return LeaderboardTile(
                      rank: batters.indexOf(p) + 1,
                      name: name,
                      primary: formatNumber(p['runs']),
                      primaryLabel: 'runs',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => PlayerProfileScreen(playerName: name),
                        ),
                      ),
                    );
                  }),
                ],
                if (bowlers.isNotEmpty) ...[
                  const SectionHeader('Top bowlers here'),
                  ...bowlers.take(10).map((p) {
                    final name = (p['player'] ?? p['bowler'] ?? '').toString();
                    return LeaderboardTile(
                      rank: bowlers.indexOf(p) + 1,
                      name: name,
                      primary: formatNumber(p['wickets']),
                      primaryLabel: 'wkts',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => PlayerProfileScreen(playerName: name),
                        ),
                      ),
                    );
                  }),
                ],
                const SizedBox(height: 24),
              ],
            ),
    );
  }
}
