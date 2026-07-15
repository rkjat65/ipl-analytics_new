import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/widgets.dart';
import 'venue_profile_screen.dart';

class VenuesScreen extends StatefulWidget {
  const VenuesScreen({super.key});

  @override
  State<VenuesScreen> createState() => _VenuesScreenState();
}

class _VenuesScreenState extends State<VenuesScreen> {
  List<Map<String, dynamic>> _venues = [];
  bool _loading = true;
  String? _error;
  final _search = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final venues = await context.read<ApiService>().getVenues();
      if (!mounted) return;
      setState(() {
        _venues = venues;
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

  String _name(Map<String, dynamic> v) =>
      (v['venue'] ?? v['name'] ?? v['ground'] ?? '').toString();

  @override
  Widget build(BuildContext context) {
    final filtered = _query.isEmpty
        ? _venues
        : _venues.where((v) => _name(v).toLowerCase().contains(_query.toLowerCase())).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Venues')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: SearchField(
              controller: _search,
              hint: 'Search venues…',
              onChanged: (q) => setState(() => _query = q),
            ),
          ),
          Expanded(
            child: _loading
                ? const LoadingView()
                : _error != null
                    ? ErrorView(message: _error!, onRetry: _load)
                    : RefreshIndicator(
                        color: CrickTheme.cyan,
                        onRefresh: _load,
                        child: ListView.builder(
                          itemCount: filtered.length,
                          itemBuilder: (_, i) {
                            final v = filtered[i];
                            final name = _name(v);
                            return CrickCard(
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => VenueProfileScreen(venueName: name)),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 42,
                                    height: 42,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: CrickTheme.bgElevated,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: CrickTheme.borderSubtle),
                                    ),
                                    child: const Icon(Icons.stadium_outlined, color: CrickTheme.cyan, size: 20),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                                        if (v['city'] != null || v['matches'] != null)
                                          Text(
                                            [
                                              if (v['city'] != null) v['city'].toString(),
                                              if (v['matches'] != null) '${formatNumber(v['matches'])} matches',
                                            ].join(' · '),
                                            style: const TextStyle(color: CrickTheme.textMuted, fontSize: 12),
                                          ),
                                      ],
                                    ),
                                  ),
                                  const Icon(Icons.chevron_right, color: CrickTheme.textMuted),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
