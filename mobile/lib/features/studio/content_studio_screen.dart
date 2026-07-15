import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:gal/gal.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/widgets.dart';
import 'studio_cards.dart';

/// Mobile Content Studio
/// Order: search → type → orientation → template → preview (full-screen for portrait)
class ContentStudioScreen extends StatefulWidget {
  const ContentStudioScreen({super.key});

  @override
  State<ContentStudioScreen> createState() => _ContentStudioScreenState();
}

class _ContentStudioScreenState extends State<ContentStudioScreen> {
  final _cardKey = GlobalKey();
  final _fullscreenCardKey = GlobalKey();
  final _playerSearch = TextEditingController();
  final _p1Search = TextEditingController();
  final _p2Search = TextEditingController();
  final _recordTitle = TextEditingController(text: 'Most Runs');
  final _recordValue = TextEditingController(text: '973');
  final _recordSubtitle = TextEditingController(text: 'IPL 2016');

  String _template = 'player';
  CardFormat _format = CardFormat.landscape;
  String _playerType = 'batting';
  String? _playerName;
  Map<String, dynamic> _playerStats = {};
  String? _p1Name;
  String? _p2Name;
  Map<String, dynamic> _p1Stats = {};
  Map<String, dynamic> _p2Stats = {};
  String? _matchId;
  Map<String, dynamic> _matchData = {};
  List<Map<String, dynamic>> _matches = [];
  List<String> _seasons = [];
  String? _selectedSeason;
  Map<String, dynamic> _seasonData = {};
  List<String> _searchResults = [];
  int _compareFocus = 1;
  bool _loadingPlayer = false;
  bool _exporting = false;
  String? _status;
  Timer? _debounce;

  static const _templates = <(String, String, IconData, Color)>[
    ('player', 'Player', Icons.person_rounded, CrickTheme.cyan),
    ('comparison', 'Compare', Icons.compare_arrows_rounded, CrickTheme.lime),
    ('match', 'Match', Icons.sports_cricket_rounded, CrickTheme.magenta),
    ('record', 'Record', Icons.emoji_events_rounded, CrickTheme.amber),
    ('season', 'Season', Icons.calendar_month_rounded, CrickTheme.purple),
  ];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _playerSearch.dispose();
    _p1Search.dispose();
    _p2Search.dispose();
    _recordTitle.dispose();
    _recordValue.dispose();
    _recordSubtitle.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    final api = context.read<ApiService>();
    try {
      final seasons = await api.getSeasons();
      final matches = await api.getMatches(limit: 40);
      if (!mounted) return;
      setState(() {
        _seasons = seasons;
        _selectedSeason = seasons.isNotEmpty ? seasons.last : null;
        _matches = asMapList(matches, 'matches');
      });
      await _loadPlayer('V Kohli');
      if (_selectedSeason != null) await _loadSeason(_selectedSeason!);
    } catch (_) {}
  }

  void _searchPlayers(String q) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 260), () async {
      if (q.trim().length < 2) {
        if (mounted) setState(() => _searchResults = []);
        return;
      }
      try {
        final res = await context.read<ApiService>().searchPlayers(q.trim());
        if (mounted) setState(() => _searchResults = res);
      } catch (_) {}
    });
  }

  Future<void> _loadPlayer(String name) async {
    setState(() {
      _loadingPlayer = true;
      _playerSearch.text = name;
      _searchResults = [];
    });
    final api = context.read<ApiService>();
    try {
      final data = _playerType == 'bowling'
          ? await api.getPlayerBowling(name)
          : await api.getPlayerBatting(name);
      final stats = asStringKeyedMap(data['career'] ?? data['overall'] ?? data['stats'] ?? data);
      if (!mounted) return;
      setState(() {
        _playerName = name;
        _playerStats = stats;
        _loadingPlayer = false;
        _status = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingPlayer = false;
        _status = e.toString();
      });
    }
  }

  Future<void> _loadComparePlayer(String name, bool isP1) async {
    try {
      final bat = await context.read<ApiService>().getPlayerBatting(name);
      final stats = asStringKeyedMap(bat['career'] ?? bat['overall'] ?? bat['stats'] ?? bat);
      if (!mounted) return;
      setState(() {
        if (isP1) {
          _p1Name = name;
          _p1Stats = stats;
          _p1Search.text = name;
        } else {
          _p2Name = name;
          _p2Stats = stats;
          _p2Search.text = name;
        }
        _searchResults = [];
      });
    } catch (e) {
      setState(() => _status = e.toString());
    }
  }

  Future<void> _loadMatch(String id) async {
    try {
      final m = await context.read<ApiService>().getMatch(id);
      if (!mounted) return;
      setState(() {
        _matchId = id;
        _matchData = m;
      });
    } catch (e) {
      setState(() => _status = e.toString());
    }
  }

  Future<void> _loadSeason(String season) async {
    try {
      final s = await context.read<ApiService>().getSeasonSummary(season);
      if (!mounted) return;
      setState(() {
        _selectedSeason = season;
        _seasonData = s;
      });
    } catch (e) {
      setState(() => _status = e.toString());
    }
  }

  void _onFormatSelected(CardFormat f) {
    setState(() => _format = f);
    if (f.isPortrait) {
      // Real phone-height preview
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _openFullscreenPreview();
      });
    }
  }

  Future<void> _export({required bool share, GlobalKey? key}) async {
    setState(() {
      _exporting = true;
      _status = null;
    });
    try {
      final useKey = key ?? (_format.isPortrait ? _fullscreenCardKey : _cardKey);
      // Prefer available boundary
      RenderRepaintBoundary? boundary =
          useKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      boundary ??= _cardKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      boundary ??= _fullscreenCardKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) throw Exception('Preview not ready — open preview first');
      final image = await boundary.toImage(pixelRatio: 2.5);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      if (bytes == null) throw Exception('Capture failed');
      final dir = await getTemporaryDirectory();
      final file = File(
        '${dir.path}/crickrida-${_template}-${_format.name}-${DateTime.now().millisecondsSinceEpoch}.png',
      );
      await file.writeAsBytes(bytes.buffer.asUint8List());
      if (share) {
        await Share.shareXFiles([XFile(file.path)], text: 'Made with Crickrida');
        setState(() => _status = 'Shared');
      } else {
        await Gal.putImage(file.path, album: 'Crickrida');
        setState(() => _status = 'Saved to gallery');
      }
    } catch (e) {
      setState(() => _status = e.toString());
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _openFullscreenPreview() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _FullscreenPreviewPage(
          format: _format,
          cardBuilder: (key) => RepaintBoundary(key: key, child: _buildCard()),
          cardKey: _fullscreenCardKey,
          exporting: _exporting,
          onShare: () => _export(share: true, key: _fullscreenCardKey),
          onSave: () => _export(share: false, key: _fullscreenCardKey),
        ),
      ),
    );
  }

  Widget _buildCard() {
    switch (_template) {
      case 'comparison':
        return StudioComparisonCard(
          p1Name: _p1Name ?? 'Player 1',
          p2Name: _p2Name ?? 'Player 2',
          p1Stats: _p1Stats,
          p2Stats: _p2Stats,
          format: _format,
        );
      case 'match':
        return StudioMatchCard(
          match: _matchData.isEmpty && _matches.isNotEmpty ? _matches.first : _matchData,
          format: _format,
        );
      case 'record':
        return StudioRecordCard(
          title: _recordTitle.text.isEmpty ? 'Record' : _recordTitle.text,
          value: _recordValue.text.isEmpty ? '—' : _recordValue.text,
          subtitle: _recordSubtitle.text,
          format: _format,
        );
      case 'season':
        return StudioSeasonCard(
          season: _selectedSeason ?? 'Season',
          data: _seasonData,
          format: _format,
        );
      case 'player':
      default:
        return StudioPlayerCard(
          playerName: _playerName ?? 'Player Name',
          stats: _playerStats,
          type: _playerType,
          format: _format,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final dims = _format.dims;
    final screenW = MediaQuery.of(context).size.width;
    final screenH = MediaQuery.of(context).size.height;

    return Scaffold(
      appBar: AppBar(title: const Text('Studio'), centerTitle: false),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.only(bottom: 12),
              children: [
                // ── 1. SEARCH AT TOP ──────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Text(
                    _template == 'comparison'
                        ? 'Search player ${_compareFocus}'
                        : _template == 'player'
                            ? 'Search player'
                            : 'Content',
                    style: GoogleFonts.spaceGrotesk(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(height: 8),
                if (_template == 'player' || _template == 'comparison') ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: SearchField(
                      controller: _template == 'comparison'
                          ? (_compareFocus == 1 ? _p1Search : _p2Search)
                          : _playerSearch,
                      hint: _template == 'comparison'
                          ? 'Search player $_compareFocus…'
                          : 'Search player…',
                      onChanged: _searchPlayers,
                    ),
                  ),
                  if (_loadingPlayer)
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                      child: LinearProgressIndicator(color: CrickTheme.cyan, minHeight: 2),
                    ),
                  if (_searchResults.isNotEmpty)
                    ..._searchResults.take(6).map(
                          (p) => ListTile(
                            dense: true,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                            leading: PlayerAvatar(name: p, size: 40),
                            title: Text(p, style: const TextStyle(fontWeight: FontWeight.w600)),
                            trailing: const Icon(Icons.add_circle_outline, color: CrickTheme.cyan, size: 20),
                            onTap: () {
                              if (_template == 'comparison') {
                                _loadComparePlayer(p, _compareFocus == 1);
                              } else {
                                _loadPlayer(p);
                              }
                            },
                          ),
                        ),
                  if (_template == 'player' && _playerName != null && _searchResults.isEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                      child: Row(
                        children: [
                          PlayerAvatar(name: _playerName!, size: 44, borderColor: CrickTheme.cyan),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _playerName!,
                              style: const TextStyle(fontWeight: FontWeight.w700, color: CrickTheme.cyan, fontSize: 15),
                            ),
                          ),
                          const Icon(Icons.check_circle, color: CrickTheme.lime, size: 18),
                        ],
                      ),
                    ),
                  if (_template == 'player') ...[
                    const SizedBox(height: 10),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        children: [
                          _segChip('Batting', _playerType == 'batting', CrickTheme.cyan, () {
                            setState(() => _playerType = 'batting');
                            if (_playerName != null) _loadPlayer(_playerName!);
                          }),
                          const SizedBox(width: 8),
                          _segChip('Bowling', _playerType == 'bowling', CrickTheme.magenta, () {
                            setState(() => _playerType = 'bowling');
                            if (_playerName != null) _loadPlayer(_playerName!);
                          }),
                        ],
                      ),
                    ),
                  ],
                  if (_template == 'comparison') ...[
                    const SizedBox(height: 10),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        children: [
                          Expanded(child: _playerPickSlot(1, _p1Name, CrickTheme.cyan)),
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 8),
                            child: Text('VS', style: TextStyle(fontWeight: FontWeight.w800, color: CrickTheme.textMuted)),
                          ),
                          Expanded(child: _playerPickSlot(2, _p2Name, CrickTheme.magenta)),
                        ],
                      ),
                    ),
                  ],
                ] else
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: _buildNonPlayerContent(),
                  ),

                // ── 2. ORIENTATION ─────────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 18, 16, 8),
                  child: Text('Orientation', style: GoogleFonts.spaceGrotesk(fontSize: 15, fontWeight: FontWeight.w700)),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: CardFormat.values.map((f) {
                      final selected = _format == f;
                      return Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(right: f != CardFormat.portrait ? 8 : 0),
                          child: Material(
                            color: selected ? CrickTheme.cyan.withValues(alpha: 0.12) : CrickTheme.bgCard,
                            borderRadius: BorderRadius.circular(12),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(12),
                              onTap: () => _onFormatSelected(f),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: selected ? CrickTheme.cyan.withValues(alpha: 0.55) : CrickTheme.borderSubtle,
                                  ),
                                ),
                                child: Column(
                                  children: [
                                    Icon(f.icon, size: 22, color: selected ? CrickTheme.cyan : CrickTheme.textMuted),
                                    const SizedBox(height: 6),
                                    Text(
                                      f.label,
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: selected ? CrickTheme.cyan : CrickTheme.textPrimary,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      f.ratio,
                                      style: GoogleFonts.jetBrainsMono(fontSize: 10, color: CrickTheme.textMuted),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),

                // ── 3. TEMPLATE ────────────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Text('Template', style: GoogleFonts.spaceGrotesk(fontSize: 15, fontWeight: FontWeight.w700)),
                ),
                SizedBox(
                  height: 84,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _templates.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, i) {
                      final t = _templates[i];
                      final selected = _template == t.$1;
                      return Material(
                        color: selected ? t.$4.withValues(alpha: 0.14) : CrickTheme.bgCard,
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => setState(() => _template = t.$1),
                          child: Container(
                            width: 84,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: selected ? t.$4.withValues(alpha: 0.55) : CrickTheme.borderSubtle,
                              ),
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(t.$3, color: selected ? t.$4 : CrickTheme.textMuted, size: 22),
                                const SizedBox(height: 8),
                                Text(
                                  t.$2,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: selected ? t.$4 : CrickTheme.textPrimary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),

                // ── 4. PREVIEW ─────────────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Row(
                    children: [
                      Text('Preview', style: GoogleFonts.spaceGrotesk(fontSize: 15, fontWeight: FontWeight.w700)),
                      const Spacer(),
                      if (_format.isPortrait)
                        TextButton.icon(
                          onPressed: _openFullscreenPreview,
                          icon: const Icon(Icons.fullscreen_rounded, size: 18, color: CrickTheme.cyan),
                          label: const Text('Full screen', style: TextStyle(color: CrickTheme.cyan, fontSize: 12)),
                        )
                      else
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: CrickTheme.bgElevated,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: CrickTheme.borderSubtle),
                          ),
                          child: Text(
                            '${_format.label} · ${_format.ratio}',
                            style: GoogleFonts.jetBrainsMono(fontSize: 11, color: CrickTheme.cyan, fontWeight: FontWeight.w700),
                          ),
                        ),
                    ],
                  ),
                ),
                if (_format.isPortrait)
                  // Portrait: tappable phone frame that opens full screen
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: GestureDetector(
                      onTap: _openFullscreenPreview,
                      child: AspectRatio(
                        aspectRatio: 9 / 16,
                        child: Container(
                          constraints: BoxConstraints(maxHeight: screenH * 0.55),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: CrickTheme.cyan.withValues(alpha: 0.45), width: 2),
                            boxShadow: [
                              BoxShadow(
                                color: CrickTheme.cyan.withValues(alpha: 0.12),
                                blurRadius: 20,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(18),
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                ColoredBox(
                                  color: CrickTheme.bgElevated,
                                  child: FittedBox(
                                    fit: BoxFit.contain,
                                    child: SizedBox(
                                      width: dims.width,
                                      height: dims.height,
                                      child: RepaintBoundary(
                                        key: _cardKey,
                                        child: _buildCard(),
                                      ),
                                    ),
                                  ),
                                ),
                                Positioned(
                                  bottom: 12,
                                  left: 0,
                                  right: 0,
                                  child: Center(
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: Colors.black.withValues(alpha: 0.65),
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: const Text(
                                        'Tap for full-screen preview',
                                        style: TextStyle(color: CrickTheme.cyan, fontSize: 12, fontWeight: FontWeight.w600),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  )
                else
                  // Landscape / Square: real aspect, uses available width
                  Center(
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 16),
                      constraints: BoxConstraints(
                        maxWidth: screenW - 32,
                        maxHeight: screenH * 0.42,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: CrickTheme.borderActive),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.35),
                            blurRadius: 18,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(13),
                        child: AspectRatio(
                          aspectRatio: dims.width / dims.height,
                          child: ColoredBox(
                            color: CrickTheme.bgElevated,
                            child: FittedBox(
                              fit: BoxFit.contain,
                              child: SizedBox(
                                width: dims.width,
                                height: dims.height,
                                child: RepaintBoundary(
                                  key: _cardKey,
                                  child: _buildCard(),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),

                if (_status != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                    child: Text(
                      _status!,
                      style: TextStyle(
                        color: _status!.toLowerCase().contains('error') || _status!.contains('Exception')
                            ? CrickTheme.danger
                            : CrickTheme.lime,
                        fontSize: 13,
                      ),
                    ),
                  ),
                const SizedBox(height: 8),
              ],
            ),
          ),

          // Sticky export bar
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              decoration: BoxDecoration(
                color: CrickTheme.bgElevated,
                border: const Border(top: BorderSide(color: CrickTheme.borderSubtle)),
                boxShadow: [
                  BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, -4)),
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _exporting
                          ? null
                          : () {
                              if (_format.isPortrait) {
                                _openFullscreenPreview();
                              } else {
                                _export(share: true);
                              }
                            },
                      icon: Icon(_format.isPortrait ? Icons.fullscreen_rounded : Icons.ios_share_rounded, size: 18),
                      label: Text(_format.isPortrait ? 'Preview' : 'Share'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: CrickTheme.textPrimary,
                        side: const BorderSide(color: CrickTheme.borderActive),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      onPressed: _exporting
                          ? null
                          : () {
                              if (_format.isPortrait) {
                                _openFullscreenPreview();
                              } else {
                                _export(share: false);
                              }
                            },
                      icon: _exporting
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: CrickTheme.bgPrimary),
                            )
                          : Icon(_format.isPortrait ? Icons.phone_android_rounded : Icons.download_rounded, size: 18),
                      label: Text(_exporting ? 'Saving…' : (_format.isPortrait ? 'Open full screen' : 'Save PNG')),
                      style: FilledButton.styleFrom(
                        backgroundColor: CrickTheme.cyan,
                        foregroundColor: CrickTheme.bgPrimary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNonPlayerContent() {
    switch (_template) {
      case 'match':
        return DropdownButtonFormField<String>(
          initialValue: _matchId,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Select match', isDense: true),
          items: _matches.map((m) {
            final id = m['match_id'].toString();
            return DropdownMenuItem(
              value: id,
              child: Text(
                '${_teamShort(m['team1'])} vs ${_teamShort(m['team2'])} · ${formatDate(m['date'])}',
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13),
              ),
            );
          }).toList(),
          onChanged: (id) {
            if (id != null) _loadMatch(id);
          },
        );
      case 'record':
        return Column(
          children: [
            TextField(
              controller: _recordTitle,
              decoration: const InputDecoration(labelText: 'Title', isDense: true),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _recordValue,
              decoration: const InputDecoration(labelText: 'Value', isDense: true),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _recordSubtitle,
              decoration: const InputDecoration(labelText: 'Subtitle', isDense: true),
              onChanged: (_) => setState(() {}),
            ),
          ],
        );
      case 'season':
        return DropdownButtonFormField<String>(
          initialValue: _selectedSeason,
          decoration: const InputDecoration(labelText: 'Season', isDense: true),
          items: _seasons.reversed.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
          onChanged: (s) {
            if (s != null) _loadSeason(s);
          },
        );
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _playerPickSlot(int slot, String? name, Color color) {
    final selected = _compareFocus == slot;
    return Material(
      color: selected ? color.withValues(alpha: 0.12) : CrickTheme.bgElevated,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => setState(() => _compareFocus = slot),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: selected ? color.withValues(alpha: 0.5) : CrickTheme.borderSubtle),
          ),
          child: Column(
            children: [
              if (name != null)
                PlayerAvatar(name: name, size: 40, borderColor: color)
              else
                Icon(Icons.person_add_alt_1, color: color, size: 28),
              const SizedBox(height: 6),
              Text(
                name ?? 'Player $slot',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _segChip(String label, bool selected, Color color, VoidCallback onTap) {
    return Material(
      color: selected ? color.withValues(alpha: 0.14) : CrickTheme.bgElevated,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: selected ? color.withValues(alpha: 0.5) : CrickTheme.borderSubtle),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: selected ? color : CrickTheme.textSecondary,
            ),
          ),
        ),
      ),
    );
  }

  String _teamShort(dynamic t) {
    final s = t?.toString() ?? '';
    if (s.length <= 18) return s;
    final parts = s.split(' ');
    if (parts.length >= 2) return parts.map((e) => e.isNotEmpty ? e[0] : '').join();
    return s.substring(0, 16);
  }
}

/// Full-screen portrait (or any format) preview — true device-height feel.
class _FullscreenPreviewPage extends StatelessWidget {
  const _FullscreenPreviewPage({
    required this.format,
    required this.cardBuilder,
    required this.cardKey,
    required this.exporting,
    required this.onShare,
    required this.onSave,
  });

  final CardFormat format;
  final Widget Function(GlobalKey key) cardBuilder;
  final GlobalKey cardKey;
  final bool exporting;
  final VoidCallback onShare;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final pad = MediaQuery.of(context).padding;
    final availH = size.height - pad.top - pad.bottom - 72;
    final availW = size.width - 24;

    // Fit 9:16 (or format) into full phone body
    final aspect = format.dims.width / format.dims.height;
    double w = availW;
    double h = w / aspect;
    if (h > availH) {
      h = availH;
      w = h * aspect;
    }

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: Text(
          '${format.label} preview',
          style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            onPressed: exporting ? null : onShare,
            icon: const Icon(Icons.ios_share_rounded),
            tooltip: 'Share',
          ),
          IconButton(
            onPressed: exporting ? null : onSave,
            icon: exporting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: CrickTheme.cyan),
                  )
                : const Icon(Icons.download_rounded, color: CrickTheme.cyan),
            tooltip: 'Save',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Center(
                child: Container(
                  width: w,
                  height: h,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: CrickTheme.cyan.withValues(alpha: 0.15),
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: FittedBox(
                      fit: BoxFit.contain,
                      child: SizedBox(
                        width: format.dims.width,
                        height: format.dims.height,
                        child: cardBuilder(cardKey),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: exporting ? null : onShare,
                      icon: const Icon(Icons.ios_share_rounded),
                      label: const Text('Share'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: CrickTheme.textPrimary,
                        side: const BorderSide(color: CrickTheme.borderActive),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      onPressed: exporting ? null : onSave,
                      icon: const Icon(Icons.download_rounded),
                      label: Text(exporting ? 'Saving…' : 'Save PNG'),
                      style: FilledButton.styleFrom(
                        backgroundColor: CrickTheme.cyan,
                        foregroundColor: CrickTheme.bgPrimary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
