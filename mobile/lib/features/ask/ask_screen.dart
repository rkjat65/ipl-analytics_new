import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/auth_provider.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/widgets.dart';
import '../auth/login_screen.dart';

class AskScreen extends StatefulWidget {
  const AskScreen({super.key});

  @override
  State<AskScreen> createState() => _AskScreenState();
}

class _AskScreenState extends State<AskScreen> {
  final _controller = TextEditingController();
  final _messages = <_ChatMsg>[];
  List<String> _suggestions = [];
  bool _busy = false;
  String? _season;

  @override
  void initState() {
    super.initState();
    _loadSuggestions();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _loadSuggestions() async {
    try {
      final s = await context.read<ApiService>().getAiSuggestions();
      if (!mounted) return;
      setState(() => _suggestions = s);
    } catch (_) {
      setState(() {
        _suggestions = [
          'Who scored the most runs in death overs in 2024?',
          'Best economy in powerplay last 5 seasons?',
          'Which team chases best at Wankhede?',
        ];
      });
    }
  }

  Future<void> _ask([String? q]) async {
    final question = (q ?? _controller.text).trim();
    if (question.isEmpty || _busy) return;

    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      final go = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Sign in required'),
          content: const Text('Ask Cricket uses AI quotas tied to your account. Sign in to continue.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Sign in')),
          ],
        ),
      );
      if (go == true && mounted) {
        await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LoginScreen()));
      }
      if (!mounted || !context.read<AuthProvider>().isAuthenticated) return;
    }

    setState(() {
      _busy = true;
      _messages.add(_ChatMsg(role: 'user', text: question));
      _controller.clear();
    });

    try {
      final api = context.read<ApiService>();
      final res = await api.askCricket(question, season: _season);
      final answer = (res['answer'] ?? res['response'] ?? res['text'] ?? res.toString()).toString();
      final rows = asMapList(res, 'data').isNotEmpty
          ? asMapList(res, 'data')
          : asMapList(res, 'rows').isNotEmpty
              ? asMapList(res, 'rows')
              : asMapList(res, 'results');
      if (!mounted) return;
      setState(() {
        _messages.add(_ChatMsg(role: 'ai', text: answer, rows: rows, raw: res));
        _busy = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _messages.add(_ChatMsg(role: 'ai', text: 'Error: $e', isError: true));
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ask Cricket'),
        actions: [
          IconButton(
            tooltip: 'Season filter',
            onPressed: () async {
              final seasons = await context.read<ApiService>().getSeasons();
              if (!mounted) return;
              final picked = await showModalBottomSheet<String?>(
                context: context,
                backgroundColor: CrickTheme.bgElevated,
                builder: (ctx) => SafeArea(
                  child: ListView(
                    children: [
                      ListTile(
                        title: const Text('All seasons'),
                        onTap: () => Navigator.pop(ctx, ''),
                      ),
                      ...seasons.reversed.map(
                        (s) => ListTile(title: Text(s), onTap: () => Navigator.pop(ctx, s)),
                      ),
                    ],
                  ),
                ),
              );
              if (picked != null) setState(() => _season = picked.isEmpty ? null : picked);
            },
            icon: const Icon(Icons.filter_list_rounded),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_season != null)
            Container(
              width: double.infinity,
              color: CrickTheme.cyan.withValues(alpha: 0.08),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Text('Season filter: $_season', style: const TextStyle(color: CrickTheme.cyan, fontSize: 12)),
            ),
          Expanded(
            child: _messages.isEmpty
                ? ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Text(
                        'Ask anything about IPL ball-by-ball data',
                        style: GoogleFonts.spaceGrotesk(fontSize: 18, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Natural language → SQL-backed analytics on 17 seasons of cricket.',
                        style: TextStyle(color: CrickTheme.textSecondary),
                      ),
                      const SizedBox(height: 18),
                      ..._suggestions.map(
                        (s) => CrickCard(
                          onTap: () => _ask(s),
                          child: Row(
                            children: [
                              const Icon(Icons.auto_awesome, color: CrickTheme.cyan, size: 18),
                              const SizedBox(width: 10),
                              Expanded(child: Text(s)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _messages.length + (_busy ? 1 : 0),
                    itemBuilder: (_, i) {
                      if (_busy && i == _messages.length) {
                        return const Padding(
                          padding: EdgeInsets.all(12),
                          child: LoadingView(message: 'Thinking…'),
                        );
                      }
                      final m = _messages[i];
                      final isUser = m.role == 'user';
                      return Align(
                        alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.symmetric(vertical: 6),
                          padding: const EdgeInsets.all(12),
                          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.88),
                          decoration: BoxDecoration(
                            color: isUser ? CrickTheme.cyan.withValues(alpha: 0.15) : CrickTheme.bgCard,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: m.isError
                                  ? CrickTheme.danger.withValues(alpha: 0.5)
                                  : isUser
                                      ? CrickTheme.cyan.withValues(alpha: 0.35)
                                      : CrickTheme.borderSubtle,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                m.text,
                                style: TextStyle(color: m.isError ? CrickTheme.danger : CrickTheme.textPrimary, height: 1.35),
                              ),
                              if (m.rows != null && m.rows!.isNotEmpty) ...[
                                const SizedBox(height: 10),
                                ...m.rows!.take(8).map((r) {
                                  return Padding(
                                    padding: const EdgeInsets.only(bottom: 4),
                                    child: Text(
                                      r.entries.take(4).map((e) => '${e.key}: ${e.value}').join(' · '),
                                      style: GoogleFonts.jetBrainsMono(fontSize: 11, color: CrickTheme.textSecondary),
                                    ),
                                  );
                                }),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      minLines: 1,
                      maxLines: 4,
                      decoration: const InputDecoration(hintText: 'Ask a cricket question…'),
                      onSubmitted: (_) => _ask(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _busy ? null : () => _ask(),
                    icon: const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChatMsg {
  _ChatMsg({required this.role, required this.text, this.rows, this.raw, this.isError = false});
  final String role;
  final String text;
  final List<Map<String, dynamic>>? rows;
  final Map<String, dynamic>? raw;
  final bool isError;
}
