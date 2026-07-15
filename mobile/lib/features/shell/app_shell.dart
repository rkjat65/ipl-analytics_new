import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../dashboard/dashboard_screen.dart';
import '../matches/matches_screen.dart';
import '../players/players_screen.dart';
import '../studio/content_studio_screen.dart';
import '../more/more_screen.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  final _pages = const [
    DashboardScreen(),
    MatchesScreen(),
    PlayersScreen(),
    ContentStudioScreen(),
    MoreScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _pages),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: CrickTheme.bgElevated,
          border: const Border(top: BorderSide(color: CrickTheme.borderSubtle)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.35),
              blurRadius: 16,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: NavigationBar(
          height: 64,
          backgroundColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          shadowColor: Colors.transparent,
          indicatorColor: CrickTheme.cyan.withValues(alpha: 0.16),
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.home_outlined, size: 22),
              selectedIcon: Icon(
                Icons.home_rounded,
                color: CrickTheme.cyan,
                size: 22,
              ),
              label: 'Home',
            ),
            NavigationDestination(
              icon: Icon(Icons.sports_cricket_outlined, size: 22),
              selectedIcon: Icon(
                Icons.sports_cricket,
                color: CrickTheme.cyan,
                size: 22,
              ),
              label: 'Matches',
            ),
            NavigationDestination(
              icon: Icon(Icons.person_search_outlined, size: 22),
              selectedIcon: Icon(
                Icons.person_search,
                color: CrickTheme.cyan,
                size: 22,
              ),
              label: 'Players',
            ),
            NavigationDestination(
              icon: Icon(Icons.dashboard_customize_outlined, size: 22),
              selectedIcon: Icon(
                Icons.dashboard_customize,
                color: CrickTheme.cyan,
                size: 22,
              ),
              label: 'Studio',
            ),
            NavigationDestination(
              icon: Icon(Icons.grid_view_outlined, size: 22),
              selectedIcon: Icon(
                Icons.grid_view_rounded,
                color: CrickTheme.cyan,
                size: 22,
              ),
              label: 'More',
            ),
          ],
        ),
      ),
    );
  }
}
