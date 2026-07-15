import 'package:crickrida/core/api_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('decodes successful JSON and sends auth header', () async {
    final client = ApiClient(
      client: MockClient((request) async {
        expect(request.url.path, '/api/health');
        expect(request.headers['Authorization'], 'Bearer session-token');
        return http.Response('{"status":"ok"}', 200);
      }),
    )..setToken('session-token');

    expect(await client.get('/health'), {'status': 'ok'});
    client.close();
  });

  test('surfaces API detail messages', () async {
    final client = ApiClient(
      client: MockClient(
        (_) async => http.Response('{"detail":"Not authenticated"}', 401),
      ),
    );

    expect(
      () => client.get('/auth/me'),
      throwsA(
        isA<ApiException>()
            .having((error) => error.statusCode, 'statusCode', 401)
            .having((error) => error.message, 'message', 'Not authenticated'),
      ),
    );
    client.close();
  });

  test('times out with a user-readable message', () async {
    final client = ApiClient(
      timeout: const Duration(milliseconds: 1),
      client: MockClient((_) async {
        await Future<void>.delayed(const Duration(milliseconds: 30));
        return http.Response('{}', 200);
      }),
    );

    expect(
      () => client.get('/slow'),
      throwsA(
        isA<ApiException>()
            .having((error) => error.statusCode, 'statusCode', 408)
            .having((error) => error.message, 'message', contains('timed out')),
      ),
    );
    client.close();
  });
}
