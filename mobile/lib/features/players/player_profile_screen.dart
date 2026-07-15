import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/widgets.dart';

class PlayerProfileScreen extends StatefulWidget {
  const PlayerProfileScreen({super.key, required this.playerName});
  final String playerName;

  @override
  State<PlayerProfileScreen> createState() => _PlayerProfileScreenState();
}

class _PlayerProfileScreenState extends State<PlayerProfileScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  Map<String, dynamic>? _batting;
  Map<String, dynamic>? _bowling;
  List<Map<String, dynamic>> _batMatchups = [];
  List<Map<String, dynamic>> _bowlMatchups = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = context.read<ApiService>();
    final name = widget.playerName;
    try {
      Map<String, dynamic>? bat;
      Map<String, dynamic>? bowl;
      List<Map<String, dynamic>> batM = [];
      List<Map<String, dynamic>> bowlM = [];
      try {
        bat = await api.getPlayerBatting(name);
      } catch (_) {}
      try {
        bowl = await api.getPlayerBowling(name);
      } catch (_) {}
      try {
        final raw = await api.getPlayerBattingMatchups(name);
        batM = asMapList(raw).isNotEmpty
            ? asMapList(raw)
            : asMapList(raw, 'matchups');
      } catch (_) {}
      try {
        final raw = await api.getPlayerBowlingMatchups(name);
        bowlM = asMapList(raw).isNotEmpty
            ? asMapList(raw)
            : asMapList(raw, 'matchups');
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _batting = bat;
        _bowling = bowl;
        _batMatchups = batM;
        _bowlMatchups = bowlM;
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

  Map<String, dynamic> get _careerBat {
    final b = _batting ?? {};
    if (b['career'] is Map) return asStringKeyedMap(b['career']);
    if (b['overall'] is Map) return asStringKeyedMap(b['overall']);
    if (b['stats'] is Map) return asStringKeyedMap(b['stats']);
    return b;
  }

  Map<String, dynamic> get _careerBowl {
    final b = _bowling ?? {};
    if (b['career'] is Map) return asStringKeyedMap(b['career']);
    if (b['overall'] is Map) return asStringKeyedMap(b['overall']);
    if (b['stats'] is Map) return asStringKeyedMap(b['stats']);
    return b;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.playerName),
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: CrickTheme.cyan,
          labelColor: CrickTheme.cyan,
          unselectedLabelColor: CrickTheme.textMuted,
          labelStyle: GoogleFonts.spaceGrotesk(
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
          tabs: const [
            Tab(text: 'Batting'),
            Tab(text: 'Bowling'),
            Tab(text: 'Matchups'),
          ],
        ),
      ),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorView(message: _error!, onRetry: _load)
          : Column(
              children: [
                _heroHeader(),
                Expanded(
                  child: TabBarView(
                    controller: _tabs,
                    children: [
                      _statsPane(
                        _careerBat,
                        isBatting: true,
                        seasons: asMapList(_batting, 'seasons'),
                      ),
                      _statsPane(
                        _careerBowl,
                        isBatting: false,
                        seasons: asMapList(_bowling, 'seasons'),
                      ),
                      _matchupsPane(),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _heroHeader() {
    final runs = _careerBat['runs'];
    final wkts = _careerBowl['wickets'];
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            CrickTheme.cyan.withValues(alpha: 0.14),
            CrickTheme.bgCard,
            CrickTheme.magenta.withValues(alpha: 0.08),
          ],
        ),
        border: Border.all(color: CrickTheme.borderSubtle),
      ),
      child: Row(
        children: [
          PlayerAvatar(
            name: widget.playerName,
            size: 88,
            radius: 18,
            borderColor: CrickTheme.cyan,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.playerName,
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'IPL career',
                  style: TextStyle(
                    color: CrickTheme.textSecondary,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    if (runs != null)
                      _pill('${formatNumber(runs)} runs', CrickTheme.cyan),
                    if (_careerBat['sr'] != null)
                      _pill(
                        'SR ${formatDecimal(_careerBat['sr'])}',
                        CrickTheme.lime,
                      ),
                    if (wkts != null)
                      _pill('${formatNumber(wkts)} wkts', CrickTheme.magenta),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _pill(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Text(
        text,
        style: GoogleFonts.jetBrainsMono(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }

  Widget _statsPane(
    Map<String, dynamic> stats, {
    required bool isBatting,
    required List<Map<String, dynamic>> seasons,
  }) {
    // Same accent cycle as Home StatCards
    final palette = isBatting
        ? [
            CrickTheme.cyan,
            CrickTheme.lime,
            CrickTheme.amber,
            CrickTheme.purple,
            CrickTheme.magenta,
            CrickTheme.cyan,
            CrickTheme.lime,
            CrickTheme.amber,
            CrickTheme.purple,
            CrickTheme.magenta,
          ]
        : [
            CrickTheme.magenta,
            CrickTheme.cyan,
            CrickTheme.amber,
            CrickTheme.lime,
            CrickTheme.purple,
            CrickTheme.magenta,
            CrickTheme.cyan,
            CrickTheme.amber,
            CrickTheme.lime,
            CrickTheme.purple,
          ];

    final items = isBatting
        ? <(String, String)>[
            ('Runs', formatNumber(stats['runs'])),
            ('Matches', formatNumber(stats['matches'])),
            ('Innings', formatNumber(stats['innings'])),
            ('Average', formatDecimal(stats['avg'])),
            ('Strike rate', formatDecimal(stats['sr'])),
            ('Highest', formatNumber(stats['highest'] ?? stats['hs'])),
            ('50s', formatNumber(stats['fifties'])),
            ('100s', formatNumber(stats['hundreds'])),
            ('Fours', formatNumber(stats['fours'])),
            ('Sixes', formatNumber(stats['sixes'])),
          ]
        : <(String, String)>[
            ('Wickets', formatNumber(stats['wickets'])),
            ('Matches', formatNumber(stats['matches'])),
            ('Innings', formatNumber(stats['innings'])),
            ('Average', formatDecimal(stats['avg'])),
            ('Economy', formatDecimal(stats['economy'])),
            ('Strike rate', formatDecimal(stats['sr'])),
            (
              'Best',
              (stats['best_figures'] ?? stats['best'] ?? '—').toString(),
            ),
            ('4W', formatNumber(stats['four_wickets'] ?? stats['four_w'])),
            ('5W', formatNumber(stats['five_wickets'] ?? stats['five_w'])),
            (
              'Dot %',
              formatDecimal(stats['dot_pct'] ?? stats['dot_percentage']),
            ),
          ];

    return ListView(
      padding: const EdgeInsets.only(bottom: 28),
      children: [
        const SectionHeader('Career stats'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: items.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 2.15,
            ),
            itemBuilder: (_, i) => StatCard(
              label: items[i].$1,
              value: items[i].$2,
              color: palette[i % palette.length],
            ),
          ),
        ),
        if (seasons.isNotEmpty) ...[
          const SectionHeader('By season'),
          ...seasons.map((s) {
            final season = (s['season'] ?? s['year'] ?? '').toString();
            final team = (s['team'] ?? '').toString();
            return CrickCard(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  Container(
                    width: 4,
                    height: 36,
                    decoration: BoxDecoration(
                      color: isBatting ? CrickTheme.cyan : CrickTheme.magenta,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          season,
                          style: GoogleFonts.jetBrainsMono(
                            color: CrickTheme.cyan,
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                          ),
                        ),
                        if (team.isNotEmpty)
                          Text(
                            team,
                            style: const TextStyle(
                              fontSize: 11,
                              color: CrickTheme.textMuted,
                            ),
                          ),
                      ],
                    ),
                  ),
                  Text(
                    isBatting
                        ? '${formatNumber(s['runs'])} r · ${formatDecimal(s['sr'])} sr'
                        : '${formatNumber(s['wickets'])} w · ${formatDecimal(s['economy'])} eco',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: isBatting ? CrickTheme.lime : CrickTheme.magenta,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ],
    );
  }

  Widget _matchupsPane() {
    return ListView(
      padding: const EdgeInsets.only(bottom: 28),
      children: [
        if (_batMatchups.isNotEmpty) ...[
          const SectionHeader('As batter vs bowlers'),
          ..._batMatchups.take(25).map((m) {
            final name = (m['bowler'] ?? m['player'] ?? m['opponent'] ?? '')
                .toString();
            return CrickCard(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Row(
                children: [
                  PlayerAvatar(name: name, size: 40),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        formatNumber(m['runs']),
                        style: GoogleFonts.jetBrainsMono(
                          color: CrickTheme.cyan,
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        '${formatNumber(m['balls'] ?? m['dismissals'])} balls',
                        style: const TextStyle(
                          fontSize: 10,
                          color: CrickTheme.textMuted,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
        ],
        if (_bowlMatchups.isNotEmpty) ...[
          const SectionHeader('As bowler vs batters'),
          ..._bowlMatchups.take(25).map((m) {
            final name = (m['batter'] ?? m['player'] ?? m['opponent'] ?? '')
                .toString();
            return CrickCard(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Row(
                children: [
                  PlayerAvatar(name: name, size: 40),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${formatNumber(m['wickets'])}w',
                        style: GoogleFonts.jetBrainsMono(
                          color: CrickTheme.magenta,
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        '${formatNumber(m['runs'])} runs',
                        style: const TextStyle(
                          fontSize: 10,
                          color: CrickTheme.textMuted,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
        ],
        if (_batMatchups.isEmpty && _bowlMatchups.isEmpty)
          const Padding(
            padding: EdgeInsets.all(32),
            child: EmptyView(message: 'No matchup data available'),
          ),
      ],
    );
  }
}
