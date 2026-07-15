import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/formatters.dart';
import '../../core/teams.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/widgets.dart';

class H2HScreen extends StatefulWidget {
  const H2HScreen({super.key});

  @override
  State<H2HScreen> createState() => _H2HScreenState();
}

class _H2HScreenState extends State<H2HScreen> {
  List<String> _teams = [];
  String? _t1;
  String? _t2;
  Map<String, dynamic>? _data;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadTeams();
  }

  Future<void> _loadTeams() async {
    try {
      final teams = await context.read<ApiService>().getTeams();
      if (!mounted) return;
      setState(() {
        _teams = teams;
        if (teams.length >= 2) {
          _t1 = teams.firstWhere((t) => t.contains('Mumbai'), orElse: () => teams[0]);
          _t2 = teams.firstWhere((t) => t.contains('Chennai'), orElse: () => teams[1]);
        }
      });
      if (_t1 != null && _t2 != null) _compare();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  Future<void> _compare() async {
    if (_t1 == null || _t2 == null || _t1 == _t2) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await context.read<ApiService>().compareTeams(_t1!, _t2!);
      if (!mounted) return;
      setState(() {
        _data = data;
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
    return Scaffold(
      appBar: AppBar(title: const Text('Head to Head')),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          CrickCard(
            child: Column(
              children: [
                DropdownButtonFormField<String>(
                  value: _t1,
                  decoration: const InputDecoration(labelText: 'Team 1'),
                  items: _teams.map((t) => DropdownMenuItem(value: t, child: Text(t, overflow: TextOverflow.ellipsis))).toList(),
                  onChanged: (v) => setState(() => _t1 = v),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _t2,
                  decoration: const InputDecoration(labelText: 'Team 2'),
                  items: _teams.map((t) => DropdownMenuItem(value: t, child: Text(t, overflow: TextOverflow.ellipsis))).toList(),
                  onChanged: (v) => setState(() => _t2 = v),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(onPressed: _loading ? null : _compare, child: const Text('Compare')),
                ),
              ],
            ),
          ),
          if (_loading) const Padding(padding: EdgeInsets.all(32), child: LoadingView()),
          if (_error != null) ErrorView(message: _error!, onRetry: _compare),
          if (!_loading && _data != null) ...[
            CrickCard(
              child: Row(
                children: [
                  Expanded(child: _teamCol(_t1!)),
                  Text('VS', style: GoogleFonts.spaceGrotesk(color: CrickTheme.cyan, fontWeight: FontWeight.w700)),
                  Expanded(child: _teamCol(_t2!, end: true)),
                ],
              ),
            ),
            CrickCard(
              child: Column(
                children: [
                  KeyValueRow('Meetings', formatNumber(_data!['matches'] ?? _data!['total_matches'] ?? _data!['played']), accent: true),
                  KeyValueRow('${teamAbbr(_t1)} wins', formatNumber(_pickWins(_t1!))),
                  KeyValueRow('${teamAbbr(_t2)} wins', formatNumber(_pickWins(_t2!))),
                  KeyValueRow('No result', formatNumber(_data!['no_result'] ?? _data!['nr'] ?? 0)),
                ],
              ),
            ),
            ..._recentMeetingTiles(),
          ],
        ],
      ),
    );
  }

  List<Widget> _recentMeetingTiles() {
    final recent = asMapList(_data, 'recent');
    final list = recent.isNotEmpty ? recent : asMapList(_data, 'matches_list');
    if (list.isEmpty) return const [];
    return [
      const SectionHeader('Recent meetings'),
      ...list.take(8).map((m) => MatchTile(match: m)),
    ];
  }

  dynamic _pickWins(String team) {
    final d = _data!;
    if (d['team1'] == team) return d['team1_wins'] ?? d['wins1'];
    if (d['team2'] == team) return d['team2_wins'] ?? d['wins2'];
    if (d[team] is Map) return (d[team] as Map)['wins'];
    if (d['wins'] is Map) return (d['wins'] as Map)[team];
    return d['${teamAbbr(team).toLowerCase()}_wins'];
  }

  Widget _teamCol(String team, {bool end = false}) {
    return Column(
      crossAxisAlignment: end ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        TeamLogo(team: team, size: 48),
        const SizedBox(height: 8),
        Text(teamAbbr(team), style: TextStyle(fontWeight: FontWeight.w700, color: teamColor(team))),
      ],
    );
  }
}
