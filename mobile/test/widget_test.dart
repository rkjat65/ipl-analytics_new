import 'package:flutter_test/flutter_test.dart';
import 'package:crickrida/main.dart';

void main() {
  testWidgets('Crickrida app boots', (tester) async {
    await tester.pumpWidget(const CrickridaApp());
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.textContaining('Crickrida'), findsWidgets);
  });
}
