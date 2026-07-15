import 'package:flutter/material.dart';
import 'config.dart';

class TeamInfo {
  final Color primary;
  final Color secondary;
  final String abbr;
  final String? logoFile;

  const TeamInfo(this.primary, this.secondary, this.abbr, [this.logoFile]);
}

const Map<String, TeamInfo> kTeamInfo = {
  'Chennai Super Kings': TeamInfo(
    Color(0xFFFCCA06),
    Color(0xFF0081E9),
    'CSK',
    'CSK.jpg',
  ),
  'Mumbai Indians': TeamInfo(
    Color(0xFF2E8BF0),
    Color(0xFFD1AB3E),
    'MI',
    'MI.jpg',
  ),
  'Royal Challengers Bangalore': TeamInfo(
    Color(0xFFEC1C24),
    Color(0xFF2B2A29),
    'RCB',
    'RCB.jpg',
  ),
  'Royal Challengers Bengaluru': TeamInfo(
    Color(0xFFEC1C24),
    Color(0xFF2B2A29),
    'RCB',
    'RCB.jpg',
  ),
  'Kolkata Knight Riders': TeamInfo(
    Color(0xFF7B5EA7),
    Color(0xFFB3A123),
    'KKR',
    'KKR.png',
  ),
  'Delhi Capitals': TeamInfo(
    Color(0xFF1768AC),
    Color(0xFFEF1B23),
    'DC',
    'DC.png',
  ),
  'Delhi Daredevils': TeamInfo(
    Color(0xFF1768AC),
    Color(0xFFEF1B23),
    'DD',
    'DC.png',
  ),
  'Punjab Kings': TeamInfo(
    Color(0xFFD4213D),
    Color(0xFFA7A9AC),
    'PBKS',
    'PK.jpg',
  ),
  'Kings XI Punjab': TeamInfo(
    Color(0xFFD4213D),
    Color(0xFFA7A9AC),
    'KXIP',
    'PK.jpg',
  ),
  'Rajasthan Royals': TeamInfo(
    Color(0xFFEA1A85),
    Color(0xFF254AA5),
    'RR',
    'RR.png',
  ),
  'Sunrisers Hyderabad': TeamInfo(
    Color(0xFFFF822A),
    Color(0xFF000000),
    'SRH',
    'SRH.jpg',
  ),
  'Gujarat Titans': TeamInfo(
    Color(0xFFA7D8DE),
    Color(0xFF1C1C2B),
    'GT',
    'GT.png',
  ),
  'Lucknow Super Giants': TeamInfo(
    Color(0xFFA72056),
    Color(0xFFFFCC00),
    'LSG',
    'LSG.png',
  ),
  'Deccan Chargers': TeamInfo(
    Color(0xFFC0C0CC),
    Color(0xFFA7A9AC),
    'DCH',
    'Decaan.jpg',
  ),
  'Rising Pune Supergiant': TeamInfo(
    Color(0xFF6F61AC),
    Color(0xFFD63D70),
    'RPS',
    'RPSG.jpg',
  ),
  'Rising Pune Supergiants': TeamInfo(
    Color(0xFF6F61AC),
    Color(0xFFD63D70),
    'RPS',
    'RPSG.jpg',
  ),
  'Gujarat Lions': TeamInfo(
    Color(0xFFE04F17),
    Color(0xFF1C1C2B),
    'GL',
    'GL.jpg',
  ),
  'Pune Warriors': TeamInfo(
    Color(0xFF2F9BE3),
    Color(0xFFE55B25),
    'PWI',
    'PW.jpg',
  ),
  'Kochi Tuskers Kerala': TeamInfo(
    Color(0xFF6F2C91),
    Color(0xFFF7B731),
    'KTK',
    'KT.png',
  ),
};

Color teamColor(String? name) =>
    kTeamInfo[name]?.primary ?? const Color(0xFF8888A0);

String teamAbbr(String? name) =>
    kTeamInfo[name]?.abbr ??
    (name == null || name.isEmpty
        ? '???'
        : name.substring(0, name.length.clamp(0, 3)).toUpperCase());

String? teamLogoUrl(String? name) {
  final file = kTeamInfo[name]?.logoFile;
  if (file == null) return null;
  return AppConfig.teamImage(file);
}
