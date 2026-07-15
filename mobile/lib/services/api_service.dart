import '../core/api_client.dart';
import '../core/formatters.dart';

/// Thin facade over all Crickrida REST endpoints.
class ApiService {
  ApiService(this.client);
  final ApiClient client;

  // ── Meta ──────────────────────────────────────────────
  Future<List<String>> getSeasons() async {
    final data = await client.get('/meta/seasons');
    if (data is List) return data.map((e) => e.toString()).toList();
    return [];
  }

  Future<List<String>> getTeams() async {
    final data = await client.get('/meta/teams');
    if (data is List) return data.map((e) => e.toString()).toList();
    return [];
  }

  Future<List<String>> searchPlayers(String q) async {
    if (q.trim().isEmpty) return [];
    final data = await client.get('/meta/players', params: {'q': q});
    if (data is List) return data.map((e) => e.toString()).toList();
    return [];
  }

  // ── Analytics ─────────────────────────────────────────
  Future<Map<String, dynamic>> getKpis({String? season}) async =>
      asStringKeyedMap(await client.get('/analytics/kpis', params: {'season': season}));

  Future<dynamic> getPhaseStats({String? season}) =>
      client.get('/analytics/phase-stats', params: {'season': season});

  Future<List<Map<String, dynamic>>> getTopTotals({String? season}) async =>
      asMapList(await client.get('/analytics/top-totals', params: {'season': season}));

  Future<List<Map<String, dynamic>>> getTopSixes({String? season}) async =>
      asMapList(await client.get('/analytics/top-sixes', params: {'season': season}));

  Future<List<Map<String, dynamic>>> getTopFours({String? season}) async =>
      asMapList(await client.get('/analytics/top-fours', params: {'season': season}));

  Future<List<Map<String, dynamic>>> getMostWins({String? season}) async =>
      asMapList(await client.get('/analytics/most-wins', params: {'season': season}));

  Future<List<Map<String, dynamic>>> getTitleWinners() async =>
      asMapList(await client.get('/analytics/title-winners'));

  Future<List<Map<String, dynamic>>> getCapWinners() async =>
      asMapList(await client.get('/analytics/cap-winners'));

  Future<dynamic> getInningsDna({String? season}) =>
      client.get('/analytics/innings-dna', params: {'season': season});

  Future<dynamic> getSixEvolution() => client.get('/analytics/six-evolution');

  Future<List<Map<String, dynamic>>> getBattingMatrix({String? season, int? minInnings}) async =>
      asMapList(await client.get('/analytics/batting-matrix', params: {
        'season': season,
        'min_innings': minInnings,
      }));

  Future<List<Map<String, dynamic>>> getBowlingMatrix({String? season, int? minInnings}) async =>
      asMapList(await client.get('/analytics/bowling-matrix', params: {
        'season': season,
        'min_innings': minInnings,
      }));

  Future<dynamic> getChaseAnalysis({String? season}) =>
      client.get('/analytics/chase-analysis', params: {'season': season});

  Future<dynamic> getDismissalTypes({String? season}) =>
      client.get('/analytics/dismissal-types', params: {'season': season});

  Future<dynamic> getPhaseDominance({String? season}) =>
      client.get('/analytics/phase-dominance', params: {'season': season});

  Future<List<Map<String, dynamic>>> getVenueAnalytics({String? season}) async =>
      asMapList(await client.get('/analytics/venues', params: {'season': season}));

  Future<dynamic> getTossImpact({String? season}) =>
      client.get('/analytics/toss-impact', params: {'season': season});

  Future<List<Map<String, dynamic>>> getManOfTheMatch({String? season}) async =>
      asMapList(await client.get('/analytics/man-of-the-match', params: {'season': season}));

  // ── Matches ───────────────────────────────────────────
  Future<Map<String, dynamic>> getMatches({
    String? season,
    String? team,
    int limit = 20,
    int offset = 0,
  }) async =>
      asStringKeyedMap(await client.get('/matches', params: {
        'season': season,
        'team': team,
        'limit': limit,
        'offset': offset,
      }));

  Future<Map<String, dynamic>> getMatch(String id) async =>
      asStringKeyedMap(await client.get('/matches/$id'));

  Future<dynamic> getWinProbability(String id) =>
      client.get('/matches/$id/win-probability');

  // ── Players ───────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getBattingLeaderboard({
    String? season,
    int limit = 25,
    String sortBy = 'runs',
    String order = 'desc',
  }) async =>
      asMapList(await client.get('/players/batting/leaderboard', params: {
        'season': season,
        'limit': limit,
        'sort_by': sortBy,
        'order': order,
      }));

  Future<List<Map<String, dynamic>>> getBowlingLeaderboard({
    String? season,
    int limit = 25,
    String sortBy = 'wickets',
    String order = 'desc',
  }) async =>
      asMapList(await client.get('/players/bowling/leaderboard', params: {
        'season': season,
        'limit': limit,
        'sort_by': sortBy,
        'order': order,
      }));

  Future<Map<String, dynamic>> getPlayerBatting(String name) async =>
      asStringKeyedMap(await client.get('/players/${Uri.encodeComponent(name)}/batting'));

  Future<Map<String, dynamic>> getPlayerBowling(String name) async =>
      asStringKeyedMap(await client.get('/players/${Uri.encodeComponent(name)}/bowling'));

  Future<dynamic> getPlayerBattingMatchups(String name) =>
      client.get('/players/${Uri.encodeComponent(name)}/matchups/batting');

  Future<dynamic> getPlayerBowlingMatchups(String name) =>
      client.get('/players/${Uri.encodeComponent(name)}/matchups/bowling');

  Future<Map<String, dynamic>> getPlayerMatchup(String batter, String bowler) async =>
      asStringKeyedMap(await client.get(
        '/players/matchup/${Uri.encodeComponent(batter)}/${Uri.encodeComponent(bowler)}',
      ));

  // ── Teams ─────────────────────────────────────────────
  Future<Map<String, dynamic>> getTeamStats(String name) async =>
      asStringKeyedMap(await client.get('/teams/${Uri.encodeComponent(name)}/stats'));

  Future<List<Map<String, dynamic>>> getTeamSeasons(String name) async =>
      asMapList(await client.get('/teams/${Uri.encodeComponent(name)}/seasons'));

  Future<List<Map<String, dynamic>>> getTeamH2H(String name) async =>
      asMapList(await client.get('/teams/${Uri.encodeComponent(name)}/h2h'));

  Future<Map<String, dynamic>> compareTeams(String t1, String t2) async =>
      asStringKeyedMap(await client.get('/teams/compare', params: {'team1': t1, 'team2': t2}));

  // ── Venues ────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getVenues() async {
    final data = await client.get('/venues');
    if (data is List) {
      return data.map((e) {
        if (e is Map) return Map<String, dynamic>.from(e);
        return {'venue': e.toString()};
      }).toList();
    }
    return asMapList(data, 'venues');
  }

  Future<Map<String, dynamic>> getVenueStats(String name) async =>
      asStringKeyedMap(await client.get('/venues/${Uri.encodeComponent(name)}/stats'));

  Future<Map<String, dynamic>> getVenueTopPerformers(String name) async =>
      asStringKeyedMap(await client.get('/venues/${Uri.encodeComponent(name)}/top-performers'));

  // ── Seasons ───────────────────────────────────────────
  Future<Map<String, dynamic>> getSeasonSummary(String season) async =>
      asStringKeyedMap(await client.get('/seasons/${Uri.encodeComponent(season)}/summary'));

  Future<List<Map<String, dynamic>>> getPointsTable(String season) async =>
      asMapList(await client.get('/seasons/${Uri.encodeComponent(season)}/points-table'));

  Future<Map<String, dynamic>> getCapRace(String season) async =>
      asStringKeyedMap(await client.get('/seasons/${Uri.encodeComponent(season)}/cap-race'));

  // ── AI ────────────────────────────────────────────────
  Future<Map<String, dynamic>> getAiStatus() async =>
      asStringKeyedMap(await client.get('/ai/status'));

  Future<Map<String, dynamic>> askCricket(String question, {String? season}) async =>
      asStringKeyedMap(await client.post('/ai/query', body: {
        'question': question,
        if (season != null && season.isNotEmpty) 'season': season,
      }));

  Future<Map<String, dynamic>> generateCommentary(Map<String, dynamic> data) async =>
      asStringKeyedMap(await client.post('/ai/commentary', body: data));

  Future<Map<String, dynamic>> generateThread(String topic, Map<String, dynamic> data) async =>
      asStringKeyedMap(await client.post('/ai/thread', body: {
        'topic': topic,
        'data': data,
      }));

  Future<List<String>> getAiSuggestions() async {
    final data = await client.get('/ai/suggestions');
    if (data is List) return data.map((e) => e.toString()).toList();
    if (data is Map && data['suggestions'] is List) {
      return (data['suggestions'] as List).map((e) => e.toString()).toList();
    }
    return [];
  }

  Future<Map<String, dynamic>> generateAiImage(Map<String, dynamic> data) async =>
      asStringKeyedMap(await client.post('/ai/generate-image', body: data));

  // ── Images ────────────────────────────────────────────
  Future<Map<String, dynamic>> generateCardImage(Map<String, dynamic> data) async =>
      asStringKeyedMap(await client.post('/images/generate-base64', body: data));

  Future<dynamic> getImageStyles() => client.get('/images/styles');
  Future<dynamic> getImageFormats() => client.get('/images/formats');

  // ── Advanced ──────────────────────────────────────────
  Future<Map<String, dynamic>> getPlayerImpact({String? player, String? season}) async =>
      asStringKeyedMap(await client.get('/advanced/player-impact', params: {
        'player': player,
        'season': season,
      }));

  Future<Map<String, dynamic>> getBattingImpact({String? player, String? season}) async =>
      asStringKeyedMap(await client.get('/advanced/batting-impact', params: {
        'player': player,
        'season': season,
      }));

  Future<dynamic> getFormIndex({String? season}) =>
      client.get('/advanced/form-index', params: {'season': season});

  Future<dynamic> getFantasyPicks({String? season}) =>
      client.get('/advanced/fantasy-picks', params: {'season': season});

  // ── Pulse ─────────────────────────────────────────────
  Future<Map<String, dynamic>> getPulseFeed({Map<String, dynamic>? params}) async =>
      asStringKeyedMap(await client.get('/pulse/feed', params: params));

  Future<Map<String, dynamic>> getPulseOnThisDay({Map<String, dynamic>? params}) async =>
      asStringKeyedMap(await client.get('/pulse/on-this-day', params: params));

  Future<dynamic> getPulseTrending({int limit = 10}) =>
      client.get('/pulse/trending', params: {'limit': limit});

  Future<Map<String, dynamic>> generateInsightCard(
    Map<String, dynamic> cardConfig, {
    Map<String, dynamic>? dimensions,
  }) async =>
      asStringKeyedMap(await client.post('/pulse/insight-card', body: {
        'card_config': cardConfig,
        if (dimensions != null) 'dimensions': dimensions,
      }));

  // ── Social ────────────────────────────────────────────
  Future<Map<String, dynamic>> getSocialStatus() async =>
      asStringKeyedMap(await client.get('/social/status'));

  Future<List<String>> getHashtags({String category = 'general'}) async {
    final data = await client.get('/social/hashtags', params: {'category': category});
    if (data is Map && data['hashtags'] is List) {
      return (data['hashtags'] as List).map((e) => e.toString()).toList();
    }
    if (data is List) return data.map((e) => e.toString()).toList();
    return [];
  }

  Future<List<dynamic>> getOptimalTimes({String platform = 'twitter'}) async {
    final data = await client.get('/social/optimal-times', params: {'platform': platform});
    if (data is Map && data['times'] is List) return data['times'] as List;
    if (data is List) return data;
    return [];
  }

  Future<List<Map<String, dynamic>>> getDrafts() async {
    final data = await client.get('/social/drafts');
    return asMapList(data, 'drafts');
  }

  Future<Map<String, dynamic>> saveDraft(Map<String, dynamic> body) async =>
      asStringKeyedMap(await client.post('/social/drafts', body: body));

  Future<void> deleteDraft(String id) async => client.delete('/social/drafts/$id');

  Future<Map<String, dynamic>> previewCompose(Map<String, dynamic> body) async =>
      asStringKeyedMap(await client.post('/social/compose/preview', body: body));

  Future<Map<String, dynamic>> postTwitter(Map<String, dynamic> body) async =>
      asStringKeyedMap(await client.post('/social/post/twitter', body: body));

  Future<Map<String, dynamic>> postThread(Map<String, dynamic> body) async =>
      asStringKeyedMap(await client.post('/social/post/thread', body: body));

  // ── Billing ───────────────────────────────────────────
  Future<dynamic> getBillingPlans() => client.get('/billing/plans');

  Future<Map<String, dynamic>> getBillingUsage() async =>
      asStringKeyedMap(await client.get('/billing/usage'));

  Future<Map<String, dynamic>> checkFeatureQuota(String feature) async =>
      asStringKeyedMap(await client.get('/billing/check/$feature'));
}
