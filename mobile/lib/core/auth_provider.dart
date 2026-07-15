import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_client.dart';
import 'formatters.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider(this._api) {
    _bootstrap();
  }

  final ApiClient _api;
  final _storage = const FlutterSecureStorage();

  Map<String, dynamic>? _user;
  bool _loading = true;
  String? _error;

  Map<String, dynamic>? get user => _user;
  bool get loading => _loading;
  bool get isAuthenticated => _user != null;
  String? get error => _error;
  String? get token => _api.token;
  String get plan => _user?['plan']?.toString() ?? 'free';
  String get displayName => _user?['name']?.toString() ?? 'Guest';

  Future<void> _bootstrap() async {
    try {
      final token = await _storage.read(key: 'auth_token');
      if (token != null && token.isNotEmpty) {
        _api.setToken(token);
        final me = await _api.get('/auth/me');
        _user = asStringKeyedMap(me);
      }
    } catch (_) {
      await _clearSession();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> login(String email, String password) async {
    _error = null;
    notifyListeners();
    try {
      final data = asStringKeyedMap(await _api.post(
        '/auth/login',
        body: {'email': email, 'password': password},
        auth: false,
      ));
      await _applyAuth(data);
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> register(String name, String email, String password) async {
    _error = null;
    notifyListeners();
    try {
      final data = asStringKeyedMap(await _api.post(
        '/auth/register',
        body: {'name': name, 'email': email, 'password': password},
        auth: false,
      ));
      await _applyAuth(data);
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> logout() async {
    try {
      if (_api.token != null) await _api.post('/auth/logout');
    } catch (_) {}
    await _clearSession();
    notifyListeners();
  }

  Future<void> refreshMe() async {
    if (_api.token == null) return;
    try {
      _user = asStringKeyedMap(await _api.get('/auth/me'));
      notifyListeners();
    } catch (_) {}
  }

  Future<void> _applyAuth(Map<String, dynamic> data) async {
    final token = data['token']?.toString();
    if (token == null || token.isEmpty) throw Exception('No token returned');
    _api.setToken(token);
    await _storage.write(key: 'auth_token', value: token);
    _user = asStringKeyedMap(data['user']);
    _error = null;
    notifyListeners();
  }

  Future<void> _clearSession() async {
    _api.setToken(null);
    _user = null;
    await _storage.delete(key: 'auth_token');
  }
}
