import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/formatters.dart';
import '../../core/teams.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/widgets.dart';
import '../players/player_profile_screen.dart';

class MatchDetailScreen extends StatefulWidget {
  const MatchDetailScreen({super.key, required this.matchId});
  final String matchId;

  @override
  State<MatchDetailScreen> createState() => _MatchDetailScreenState();
}

class _MatchDetailScreenState extends State<MatchDetailScreen> {
  Map<String, dynamic>? _match;
  bool _loading = true;
  String? _error;
  int _tab = 0; // scorecard innings index

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
    try {
      final data = await context.read<ApiService>().getMatch(widget.matchId);
      if (!mounted) return;
      setState(() {
        _match = data;
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

  Map<String, dynamic> get _info {
    final m = _match ?? {};
    final info = asStringKeyedMap(m['info']);
    if (info.isNotEmpty) return info;
    return asStringKeyedMap(m);
  }

  List<Map<String, dynamic>> get _scorecards {
    final m = _match ?? {};
    // API returns "scorecards" — also accept legacy keys
    final list = asMapList(m, 'scorecards');
    if (list.isNotEmpty) return list;
    return asMapList(m, 'innings');
  }

  String _oversFromBalls(dynamic balls) {
    final n = (balls is num)
        ? balls.toInt()
        : int.tryParse(balls?.toString() ?? '') ?? 0;
    return '${n ~/ 6}.${n % 6}';
  }

  String _dismissalText(Map<String, dynamic> b) {
    final kind = b['dismissal']?.toString();
    if (kind == null || kind.isEmpty || kind == 'null') return 'not out';
    final bowler = b['dismissed_by']?.toString();
    final fielder = b['fielder']?.toString();
    switch (kind) {
      case 'caught':
        if (fielder != null && bowler != null) return 'c $fielder b $bowler';
        if (bowler != null) return 'c & b $bowler';
        return 'caught';
      case 'bowled':
        return bowler != null ? 'b $bowler' : 'bowled';
      case 'lbw':
        return bowler != null ? 'lbw b $bowler' : 'lbw';
      case 'run out':
        return fielder != null ? 'run out ($fielder)' : 'run out';
      case 'stumped':
        return fielder != null && bowler != null
            ? 'st $fielder b $bowler'
            : 'stumped';
      default:
        return bowler != null ? '$kind b $bowler' : kind;
    }
  }

  @override
  Widget build(BuildContext context) {
    final info = _info;
    final t1 = (info['team1'] ?? '').toString();
    final t2 = (info['team2'] ?? '').toString();
    final title = (t1.isNotEmpty && t2.isNotEmpty)
        ? '${teamAbbr(t1)} vs ${teamAbbr(t2)}'
        : 'Match';

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          IconButton(
            tooltip: 'Refresh match',
            onPressed: _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorView(message: _error!, onRetry: _load)
          : _buildBody(info, t1, t2),
    );
  }

  Widget _buildBody(Map<String, dynamic> info, String t1, String t2) {
    final scorecards = _scorecards;
    final innIndex = scorecards.isEmpty
        ? 0
        : _tab.clamp(0, scorecards.length - 1);

    return ListView(
      padding: const EdgeInsets.only(bottom: 28),
      children: [
        // ── Match hero ──────────────────────────────────
        Container(
          margin: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                teamColor(t1).withValues(alpha: 0.22),
                CrickTheme.bgCard,
                teamColor(t2).withValues(alpha: 0.18),
              ],
            ),
            border: Border.all(color: CrickTheme.borderSubtle),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Text(
                    (info['season'] ?? '').toString(),
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 11,
                      color: CrickTheme.cyan,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    formatDate(info['date']),
                    style: const TextStyle(
                      fontSize: 11,
                      color: CrickTheme.textMuted,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(child: _teamCol(t1)),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Column(
                      children: [
                        Text(
                          'VS',
                          style: GoogleFonts.spaceGrotesk(
                            fontWeight: FontWeight.w800,
                            color: CrickTheme.cyan,
                            fontSize: 16,
                          ),
                        ),
                        if (scorecards.length >= 2) ...[
                          const SizedBox(height: 8),
                          ...scorecards.map((sc) {
                            final team = sc['batting_team']?.toString() ?? '';
                            final runs = sc['total_runs'];
                            final wkts = sc['total_wickets'];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 2),
                              child: Text(
                                '${teamAbbr(team)} ${formatNumber(runs)}/${formatNumber(wkts)}',
                                style: GoogleFonts.jetBrainsMono(
                                  fontSize: 11,
                                  color: CrickTheme.textSecondary,
                                ),
                              ),
                            );
                          }),
                        ],
                      ],
                    ),
                  ),
                  Expanded(child: _teamCol(t2, end: true)),
                ],
              ),
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: CrickTheme.bgPrimary.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  matchResult(info),
                  textAlign: TextAlign.center,
                  style: GoogleFonts.spaceGrotesk(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
              if (info['venue'] != null) ...[
                const SizedBox(height: 8),
                Text(
                  info['venue'].toString(),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 12,
                    color: CrickTheme.textMuted,
                  ),
                ),
              ],
            ],
          ),
        ),

        // ── Meta chips ──────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _metaChip(
                Icons.sports,
                'Toss: ${info['toss_winner'] ?? '—'} (${info['toss_decision'] ?? ''})',
              ),
              if (info['player_of_match'] != null)
                GestureDetector(
                  onTap: () => _openPlayer(info['player_of_match'].toString()),
                  child: _metaChip(
                    Icons.emoji_events_outlined,
                    'PoM: ${info['player_of_match']}',
                    color: CrickTheme.amber,
                  ),
                ),
              if (info['umpire1'] != null)
                _metaChip(
                  Icons.person_outline,
                  'Umpires: ${info['umpire1']}, ${info['umpire2'] ?? ''}',
                ),
            ],
          ),
        ),

        if (scorecards.isEmpty)
          const CrickCard(
            child: Text(
              'Scorecard data not available for this match.',
              style: TextStyle(color: CrickTheme.textSecondary),
            ),
          )
        else ...[
          // Innings switcher
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
            child: Row(
              children: List.generate(scorecards.length, (i) {
                final sc = scorecards[i];
                final selected = i == innIndex;
                final team =
                    sc['batting_team']?.toString() ?? 'Innings ${i + 1}';
                return Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(
                      right: i < scorecards.length - 1 ? 8 : 0,
                    ),
                    child: Material(
                      color: selected
                          ? CrickTheme.cyan.withValues(alpha: 0.14)
                          : CrickTheme.bgCard,
                      borderRadius: BorderRadius.circular(12),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () => setState(() => _tab = i),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            vertical: 10,
                            horizontal: 8,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: selected
                                  ? CrickTheme.cyan.withValues(alpha: 0.5)
                                  : CrickTheme.borderSubtle,
                            ),
                          ),
                          child: Column(
                            children: [
                              Text(
                                teamAbbr(team),
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: selected
                                      ? CrickTheme.cyan
                                      : CrickTheme.textPrimary,
                                  fontSize: 13,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${formatNumber(sc['total_runs'])}/${formatNumber(sc['total_wickets'])} (${_oversFromBalls(sc['total_balls'])})',
                                style: GoogleFonts.jetBrainsMono(
                                  fontSize: 11,
                                  color: CrickTheme.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),

          _scorecardPane(scorecards[innIndex]),
        ],
      ],
    );
  }

  Widget _scorecardPane(Map<String, dynamic> sc) {
    final team = sc['batting_team']?.toString() ?? '';
    final batters = asMapList(sc, 'batting');
    final bowlers = asMapList(sc, 'bowling');
    final fow = asMapList(sc, 'fall_of_wickets');
    final partnerships = asMapList(sc, 'partnerships');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Batting header
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
          child: Row(
            children: [
              TeamLogo(team: team, size: 26),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '$team batting',
                  style: GoogleFonts.spaceGrotesk(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
              ),
              Text(
                '${formatNumber(sc['total_runs'])}/${formatNumber(sc['total_wickets'])}',
                style: GoogleFonts.jetBrainsMono(
                  color: CrickTheme.cyan,
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                ),
              ),
            ],
          ),
        ),

        // Batting table header
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 12),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: CrickTheme.bgElevated,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            border: Border.all(color: CrickTheme.borderSubtle),
          ),
          child: Row(
            children: [
              const Expanded(
                flex: 5,
                child: Text(
                  'Batter',
                  style: TextStyle(
                    fontSize: 11,
                    color: CrickTheme.textMuted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              _colH('R', 28),
              _colH('B', 28),
              _colH('4s', 28),
              _colH('6s', 28),
              _colH('SR', 40),
            ],
          ),
        ),

        Container(
          margin: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: CrickTheme.bgCard,
            borderRadius: const BorderRadius.vertical(
              bottom: Radius.circular(12),
            ),
            border: const Border(
              left: BorderSide(color: CrickTheme.borderSubtle),
              right: BorderSide(color: CrickTheme.borderSubtle),
              bottom: BorderSide(color: CrickTheme.borderSubtle),
            ),
          ),
          child: Column(
            children: [
              ...batters.map((b) {
                final name = (b['batter'] ?? '').toString();
                final isOut =
                    b['dismissal'] != null &&
                    b['dismissal'].toString().isNotEmpty;
                return InkWell(
                  onTap: name.isEmpty ? null : () => _openPlayer(name),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          flex: 5,
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              PlayerAvatar(name: name, size: 32),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      name,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      _dismissalText(b),
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: isOut
                                            ? CrickTheme.textMuted
                                            : CrickTheme.lime,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        _colV(
                          formatNumber(b['runs']),
                          28,
                          bold: true,
                          color: CrickTheme.cyan,
                        ),
                        _colV(formatNumber(b['balls']), 28),
                        _colV(formatNumber(b['fours']), 28),
                        _colV(formatNumber(b['sixes']), 28),
                        _colV(formatDecimal(b['strike_rate'], 1), 40),
                      ],
                    ),
                  ),
                );
              }),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: const BoxDecoration(
                  border: Border(
                    top: BorderSide(color: CrickTheme.borderSubtle),
                  ),
                ),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'TOTAL',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    Text(
                      '${formatNumber(sc['total_runs'])}/${formatNumber(sc['total_wickets'])}  (${_oversFromBalls(sc['total_balls'])} ov)',
                      style: GoogleFonts.jetBrainsMono(
                        fontWeight: FontWeight.w700,
                        color: CrickTheme.cyan,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // Fall of wickets
        if (fow.isNotEmpty) ...[
          const SectionHeader('Fall of wickets'),
          CrickCard(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: fow.map((f) {
                return Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: CrickTheme.bgElevated,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: CrickTheme.borderSubtle),
                  ),
                  child: Text(
                    '${formatNumber(f['score'])}/${formatNumber(f['wicket_number'])}  ${f['player_dismissed'] ?? ''} (${f['over_ball'] ?? ''})',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 11,
                      color: CrickTheme.textSecondary,
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],

        // Partnerships
        if (partnerships.isNotEmpty) ...[
          const SectionHeader('Partnerships'),
          ...partnerships.map((p) {
            return CrickCard(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: CrickTheme.purple.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${(p['partnership_number'] is num ? (p['partnership_number'] as num).toInt() + 1 : p['partnership_number'])}',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 11,
                        color: CrickTheme.purple,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      (p['pair'] ?? '').toString(),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Text(
                    '${formatNumber(p['runs'])} (${formatNumber(p['balls'])})',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 12,
                      color: CrickTheme.lime,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],

        // Bowling
        if (bowlers.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
            child: Text(
              '${sc['bowling_team'] ?? 'Bowling'} bowling',
              style: GoogleFonts.spaceGrotesk(
                fontWeight: FontWeight.w700,
                fontSize: 15,
              ),
            ),
          ),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 12),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: CrickTheme.bgElevated,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(12),
              ),
              border: Border.all(color: CrickTheme.borderSubtle),
            ),
            child: Row(
              children: [
                const Expanded(
                  flex: 5,
                  child: Text(
                    'Bowler',
                    style: TextStyle(
                      fontSize: 11,
                      color: CrickTheme.textMuted,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                _colH('O', 32),
                _colH('M', 28),
                _colH('R', 32),
                _colH('W', 28),
                _colH('Econ', 40),
              ],
            ),
          ),
          Container(
            margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            decoration: BoxDecoration(
              color: CrickTheme.bgCard,
              borderRadius: const BorderRadius.vertical(
                bottom: Radius.circular(12),
              ),
              border: const Border(
                left: BorderSide(color: CrickTheme.borderSubtle),
                right: BorderSide(color: CrickTheme.borderSubtle),
                bottom: BorderSide(color: CrickTheme.borderSubtle),
              ),
            ),
            child: Column(
              children: bowlers.map((b) {
                final name = (b['bowler'] ?? '').toString();
                return InkWell(
                  onTap: name.isEmpty ? null : () => _openPlayer(name),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          flex: 5,
                          child: Row(
                            children: [
                              PlayerAvatar(name: name, size: 32),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  name,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        _colV((b['overs'] ?? '—').toString(), 32),
                        _colV(formatNumber(b['maidens']), 28),
                        _colV(
                          formatNumber(b['runs_conceded'] ?? b['runs']),
                          32,
                        ),
                        _colV(
                          formatNumber(b['wickets']),
                          28,
                          bold: true,
                          color: CrickTheme.magenta,
                        ),
                        _colV(formatDecimal(b['economy'], 1), 40),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
        const SizedBox(height: 12),
      ],
    );
  }

  Widget _teamCol(String team, {bool end = false}) {
    return Column(
      crossAxisAlignment: end
          ? CrossAxisAlignment.end
          : CrossAxisAlignment.start,
      children: [
        TeamLogo(team: team, size: 52),
        const SizedBox(height: 8),
        Text(
          teamAbbr(team),
          style: GoogleFonts.spaceGrotesk(
            fontWeight: FontWeight.w800,
            fontSize: 18,
            color: teamColor(team),
          ),
        ),
        Text(
          team,
          textAlign: end ? TextAlign.right : TextAlign.left,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 11,
            color: CrickTheme.textSecondary,
            height: 1.25,
          ),
        ),
      ],
    );
  }

  Widget _metaChip(
    IconData icon,
    String text, {
    Color color = CrickTheme.textSecondary,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: CrickTheme.bgCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: CrickTheme.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 280),
            child: Text(
              text,
              style: TextStyle(fontSize: 11, color: color),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _colH(String t, double w) => SizedBox(
    width: w,
    child: Text(
      t,
      textAlign: TextAlign.right,
      style: const TextStyle(
        fontSize: 11,
        color: CrickTheme.textMuted,
        fontWeight: FontWeight.w600,
      ),
    ),
  );

  Widget _colV(String t, double w, {bool bold = false, Color? color}) =>
      SizedBox(
        width: w,
        child: Text(
          t,
          textAlign: TextAlign.right,
          style: GoogleFonts.jetBrainsMono(
            fontSize: 12,
            fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
            color: color ?? CrickTheme.textPrimary,
          ),
        ),
      );

  void _openPlayer(String name) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => PlayerProfileScreen(playerName: name)),
    );
  }
}
