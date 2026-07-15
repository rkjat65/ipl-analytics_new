import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/widgets.dart';

class SocialScreen extends StatefulWidget {
  const SocialScreen({super.key});

  @override
  State<SocialScreen> createState() => _SocialScreenState();
}

class _SocialScreenState extends State<SocialScreen> {
  final _text = TextEditingController();
  List<String> _hashtags = [];
  List<String> _selectedTags = [];
  List<Map<String, dynamic>> _drafts = [];
  List<dynamic> _times = [];
  Map<String, dynamic>? _status;
  Map<String, dynamic>? _previewData;
  bool _loading = true;
  bool _busy = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final api = context.read<ApiService>();
    try {
      final results = await Future.wait([
        api.getSocialStatus(),
        api.getHashtags(),
        api.getOptimalTimes(),
        api.getDrafts(),
      ]);
      if (!mounted) return;
      setState(() {
        _status = results[0] as Map<String, dynamic>;
        _hashtags = results[1] as List<String>;
        _times = results[2] as List<dynamic>;
        _drafts = results[3] as List<Map<String, dynamic>>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _message = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _runPreview() async {
    setState(() => _busy = true);
    try {
      final p = await context.read<ApiService>().previewCompose({
        'text': _text.text,
        'hashtags': _selectedTags,
        'platform': 'twitter',
      });
      if (!mounted) return;
      setState(() {
        _previewData = p;
        _busy = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _message = e.toString();
        _busy = false;
      });
    }
  }

  Future<void> _saveDraft() async {
    setState(() => _busy = true);
    try {
      await context.read<ApiService>().saveDraft({
        'text': _text.text,
        'hashtags': _selectedTags,
        'platform': 'twitter',
        'status': 'draft',
      });
      await _load();
      if (!mounted) return;
      setState(() {
        _message = 'Draft saved';
        _busy = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _message = e.toString();
        _busy = false;
      });
    }
  }

  Future<void> _post() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Post to Twitter/X?'),
        content: const Text('This uses the server-side social credentials configured for Crickrida.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Post')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await context.read<ApiService>().postTwitter({
        'text': _text.text,
        'hashtags': _selectedTags,
      });
      if (!mounted) return;
      setState(() {
        _message = 'Posted';
        _busy = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _message = e.toString();
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Social Compose')),
      body: _loading
          ? const LoadingView()
          : ListView(
              padding: const EdgeInsets.only(bottom: 28),
              children: [
                if (_status != null)
                  CrickCard(
                    child: Text(
                      'Social status: ${_status.toString()}',
                      style: const TextStyle(color: CrickTheme.textSecondary, fontSize: 12),
                    ),
                  ),
                CrickCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextField(
                        controller: _text,
                        minLines: 4,
                        maxLines: 8,
                        decoration: const InputDecoration(
                          labelText: 'Compose',
                          alignLabelWithHint: true,
                          hintText: 'Write your cricket take…',
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text('Hashtags', style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: _hashtags.map((t) {
                          final selected = _selectedTags.contains(t);
                          return FilterChip(
                            label: Text(t.startsWith('#') ? t : '#$t'),
                            selected: selected,
                            onSelected: (v) {
                              setState(() {
                                if (v) {
                                  _selectedTags = [..._selectedTags, t];
                                } else {
                                  _selectedTags = _selectedTags.where((x) => x != t).toList();
                                }
                              });
                            },
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(onPressed: _busy ? null : _runPreview, child: const Text('Preview')),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton(onPressed: _busy ? null : _saveDraft, child: const Text('Save draft')),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: FilledButton(onPressed: _busy ? null : _post, child: const Text('Post')),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (_message != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(_message!, style: const TextStyle(color: CrickTheme.cyan, fontSize: 12)),
                  ),
                if (_previewData != null) ...[
                  const SectionHeader('Preview'),
                  CrickCard(
                    child: Text(
                      (_previewData!['text'] ?? _previewData!['preview'] ?? _previewData.toString()).toString(),
                      style: const TextStyle(height: 1.4),
                    ),
                  ),
                ],
                if (_times.isNotEmpty) ...[
                  const SectionHeader('Optimal times'),
                  CrickCard(
                    child: Text(
                      _times.take(8).map((e) => e.toString()).join('\n'),
                      style: GoogleFonts.jetBrainsMono(fontSize: 12, color: CrickTheme.textSecondary),
                    ),
                  ),
                ],
                if (_drafts.isNotEmpty) ...[
                  const SectionHeader('Drafts'),
                  ..._drafts.map((d) {
                    return CrickCard(
                      onTap: () {
                        setState(() {
                          _text.text = (d['text'] ?? '').toString();
                          final tags = d['hashtags'];
                          if (tags is List) {
                            _selectedTags = tags.map((e) => e.toString()).toList();
                          }
                        });
                      },
                      child: Text(
                        (d['text'] ?? d.toString()).toString(),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: CrickTheme.textSecondary),
                      ),
                    );
                  }),
                ],
              ],
            ),
    );
  }
}
