import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'config.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({http.Client? client, this.timeout = const Duration(seconds: 20)})
    : _client = client ?? http.Client();

  final http.Client _client;
  final Duration timeout;
  String? _token;

  String? get token => _token;

  void setToken(String? token) => _token = token;

  void close() => _client.close();

  Uri _uri(String path, [Map<String, dynamic>? params]) {
    final p = path.startsWith('/') ? path : '/$path';
    final uri = Uri.parse('${AppConfig.apiPrefix}$p');
    if (params == null || params.isEmpty) return uri;
    final q = <String, String>{};
    params.forEach((k, v) {
      if (v != null && v.toString().isNotEmpty) q[k] = v.toString();
    });
    return uri.replace(queryParameters: q);
  }

  Map<String, String> _headers({bool jsonBody = false, bool auth = true}) {
    final h = <String, String>{'Accept': 'application/json'};
    if (jsonBody) h['Content-Type'] = 'application/json';
    if (auth && _token != null && _token!.isNotEmpty) {
      h['Authorization'] = 'Bearer $_token';
    }
    return h;
  }

  Future<dynamic> get(
    String path, {
    Map<String, dynamic>? params,
    bool auth = true,
  }) async {
    return _request(
      () => _client.get(_uri(path, params), headers: _headers(auth: auth)),
    );
  }

  Future<dynamic> post(
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    return _request(
      () => _client.post(
        _uri(path),
        headers: _headers(jsonBody: true, auth: auth),
        body: body == null ? null : jsonEncode(body),
      ),
    );
  }

  Future<dynamic> delete(String path, {bool auth = true}) async {
    return _request(
      () => _client.delete(_uri(path), headers: _headers(auth: auth)),
    );
  }

  Future<dynamic> _request(Future<http.Response> Function() send) async {
    try {
      final response = await send().timeout(timeout);
      return _decode(response);
    } on TimeoutException {
      throw ApiException(
        408,
        'The request timed out. Check your connection and try again.',
      );
    } on http.ClientException {
      throw ApiException(
        0,
        'Unable to reach Crickrida. Check your internet connection.',
      );
    }
  }

  dynamic _decode(http.Response res) {
    dynamic body;
    try {
      body = res.body.isEmpty ? null : jsonDecode(res.body);
    } catch (_) {
      body = res.body;
    }
    if (res.statusCode >= 200 && res.statusCode < 300) return body;
    String msg = 'Request failed (${res.statusCode})';
    if (body is Map) {
      final d = body['detail'];
      if (d is String) {
        msg = d;
      } else if (d != null) {
        msg = d.toString();
      } else if (body['message'] != null) {
        msg = body['message'].toString();
      }
    }
    throw ApiException(res.statusCode, msg);
  }
}
