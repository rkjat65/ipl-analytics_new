import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/widgets.dart';

class PulseScreen extends StatefulWidget {
  const PulseScreen({super.key});

  @override
  State<PulseScreen> createState() => _PulseScreenState();
}

class _PulseScreenState extends State<PulseScreen> {
  List<Map<String, dynamic>> _feed = [];
  List<Map<String, dynamic>> _onThisDay = [];
  dynamic _trending;
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
      final feed = await api.getPulseFeed();
      Map<String, dynamic> otd = {};
      dynamic trending;
      try {
        otd = await api.getPulseOnThisDay();
      } catch (_) {}
      try {
        trending = await api.getPulseTrending();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _feed = asMapList(feed, 'insights').isNotEmpty
            ? asMapList(feed, 'insights')
            : asMapList(feed, 'items').isNotEmpty
            ? asMapList(feed, 'items')
            : asMapList(feed, 'feed');
        _onThisDay = asMapList(otd, 'insights').isNotEmpty
            ? asMapList(otd, 'insights')
            : asMapList(otd, 'items').isNotEmpty
            ? asMapList(otd, 'items')
            : asMapList(otd);
        _trending = trending;
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
      appBar: AppBar(title: const Text('Cricket Pulse')),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorView(message: _error!, onRetry: _load)
          : RefreshIndicator(
              color: CrickTheme.cyan,
              onRefresh: _load,
              child: ListView(
                children: [
                  if (_onThisDay.isNotEmpty) ...[
                    const SectionHeader('On this day'),
                    ..._onThisDay.take(5).map(_insightCard),
                  ],
                  const SectionHeader('Insight feed'),
                  if (_feed.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(24),
                      child: EmptyView(message: 'No pulse insights right now'),
                    )
                  else
                    ..._feed.map(_insightCard),
                  if (_trending != null) ...[
                    const SectionHeader('Trending'),
                    CrickCard(
                      child: Text(
                        _trending.toString(),
                        style: const TextStyle(
                          color: CrickTheme.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                ],
              ),
            ),
    );
  }

  Widget _insightCard(Map<String, dynamic> insight) {
    final title =
        (insight['title'] ??
                insight['headline'] ??
                insight['category'] ??
                'Insight')
            .toString();
    final body =
        (insight['text'] ??
                insight['body'] ??
                insight['description'] ??
                insight['insight'] ??
                '')
            .toString();
    final score = insight['shareability_score'] ?? insight['score'];
    return CrickCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: GoogleFonts.spaceGrotesk(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
              ),
              if (score != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: CrickTheme.lime.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    formatNumber(score),
                    style: GoogleFonts.jetBrainsMono(
                      color: CrickTheme.lime,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          if (body.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              body,
              style: const TextStyle(
                color: CrickTheme.textSecondary,
                height: 1.35,
              ),
            ),
          ],
          if (insight['stats'] is Map) ...[
            const SizedBox(height: 8),
            Text(
              (insight['stats'] as Map).entries
                  .take(4)
                  .map((e) => '${e.key}: ${e.value}')
                  .join(' · '),
              style: GoogleFonts.jetBrainsMono(
                fontSize: 11,
                color: CrickTheme.cyan,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
