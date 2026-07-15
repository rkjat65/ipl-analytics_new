import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/formatters.dart';
import '../../core/teams.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/widgets.dart';

class TeamProfileScreen extends StatefulWidget {
  const TeamProfileScreen({super.key, required this.teamName});
  final String teamName;

  @override
  State<TeamProfileScreen> createState() => _TeamProfileScreenState();
}

class _TeamProfileScreenState extends State<TeamProfileScreen> {
  Map<String, dynamic>? _stats;
  List<Map<String, dynamic>> _seasons = [];
  List<Map<String, dynamic>> _h2h = [];
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
    final name = widget.teamName;
    try {
      final results = await Future.wait([
        api.getTeamStats(name),
        api.getTeamSeasons(name),
        api.getTeamH2H(name),
      ]);
      if (!mounted) return;
      setState(() {
        _stats = results[0] as Map<String, dynamic>;
        _seasons = results[1] as List<Map<String, dynamic>>;
        _h2h = results[2] as List<Map<String, dynamic>>;
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
    final color = teamColor(widget.teamName);
    return Scaffold(
      appBar: AppBar(title: Text(widget.teamName)),
      body: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : ListView(
                  children: [
                    Container(
                      margin: const EdgeInsets.all(16),
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        gradient: LinearGradient(
                          colors: [color.withValues(alpha: 0.25), CrickTheme.bgCard],
                        ),
                        border: Border.all(color: color.withValues(alpha: 0.4)),
                      ),
                      child: Row(
                        children: [
                          TeamLogo(team: widget.teamName, size: 64),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(widget.teamName, style: GoogleFonts.spaceGrotesk(fontSize: 20, fontWeight: FontWeight.w700)),
                                Text(teamAbbr(widget.teamName), style: TextStyle(color: color, fontWeight: FontWeight.w700)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (_stats != null) ...[
                      const SectionHeader('Overall'),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: GridView.count(
                          crossAxisCount: 2,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          childAspectRatio: 1.5,
                          children: [
                            StatCard(label: 'Matches', value: formatNumber(_stats!['matches'] ?? _stats!['played'])),
                            StatCard(label: 'Wins', value: formatNumber(_stats!['wins']), color: CrickTheme.lime),
                            StatCard(label: 'Win %', value: formatDecimal(_stats!['win_pct'] ?? _stats!['win_percentage']), color: CrickTheme.amber),
                            StatCard(label: 'Titles', value: formatNumber(_stats!['titles'] ?? _stats!['championships']), color: CrickTheme.magenta),
                          ],
                        ),
                      ),
                      CrickCard(
                        child: Column(
                          children: [
                            KeyValueRow('Highest score', formatNumber(_stats!['highest_score'] ?? _stats!['highest_total'])),
                            KeyValueRow('Lowest score', formatNumber(_stats!['lowest_score'] ?? _stats!['lowest_total'])),
                            KeyValueRow('Avg scored', formatDecimal(_stats!['avg_scored'] ?? _stats!['avg_runs'])),
                            KeyValueRow('Avg conceded', formatDecimal(_stats!['avg_conceded'])),
                          ],
                        ),
                      ),
                    ],
                    if (_seasons.isNotEmpty) ...[
                      const SectionHeader('Season by season'),
                      ..._seasons.map((s) {
                        return CrickCard(
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  (s['season'] ?? s['year'] ?? '').toString(),
                                  style: GoogleFonts.jetBrainsMono(color: CrickTheme.cyan, fontWeight: FontWeight.w700),
                                ),
                              ),
                              Text(
                                '${formatNumber(s['wins'] ?? s['W'])}W · ${formatNumber(s['matches'] ?? s['played'])}M',
                                style: const TextStyle(color: CrickTheme.textSecondary, fontSize: 13),
                              ),
                            ],
                          ),
                        );
                      }),
                    ],
                    if (_h2h.isNotEmpty) ...[
                      const SectionHeader('Head to head'),
                      ..._h2h.map((h) {
                        final opp = (h['opponent'] ?? h['team'] ?? h['vs'] ?? '').toString();
                        return CrickCard(
                          child: Row(
                            children: [
                              TeamLogo(team: opp, size: 32),
                              const SizedBox(width: 10),
                              Expanded(child: Text(opp, style: const TextStyle(fontWeight: FontWeight.w600))),
                              Text(
                                '${formatNumber(h['wins'] ?? h['won'])}-${formatNumber(h['losses'] ?? h['lost'])}',
                                style: GoogleFonts.jetBrainsMono(color: CrickTheme.lime, fontWeight: FontWeight.w700),
                              ),
                            ],
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
