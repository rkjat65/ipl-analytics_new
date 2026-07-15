import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shimmer/shimmer.dart';
import '../core/config.dart';
import '../core/formatters.dart';
import '../core/teams.dart';
import '../core/theme.dart';

class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.message = 'Loading…'});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: 32,
            height: 32,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: CrickTheme.cyan,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            message,
            style: const TextStyle(
              color: CrickTheme.textSecondary,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              color: CrickTheme.magenta,
              size: 40,
            ),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: CrickTheme.textSecondary),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              FilledButton(onPressed: onRetry, child: const Text('Retry')),
            ],
          ],
        ),
      ),
    );
  }
}

class EmptyView extends StatelessWidget {
  const EmptyView({super.key, this.message = 'Nothing here yet'});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(message, style: const TextStyle(color: CrickTheme.textMuted)),
    );
  }
}

/// Compact KPI tile — fixed height, no wasted vertical space.
class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.label,
    required this.value,
    this.subtitle,
    this.color = CrickTheme.cyan,
    this.onTap,
  });

  final String label;
  final String value;
  final String? subtitle;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: CrickTheme.bgCard,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          constraints: const BoxConstraints(minHeight: 72),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.18)),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [color.withValues(alpha: 0.08), CrickTheme.bgCard],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label.toUpperCase(),
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  color: color,
                  letterSpacing: 0.6,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  height: 1.1,
                  color: CrickTheme.textPrimary,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 10,
                    color: CrickTheme.textMuted,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.trailing, this.onSeeAll});
  final String title;
  final Widget? trailing;
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 12, 8),
      child: Row(
        children: [
          Container(
            width: 3,
            height: 14,
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              color: CrickTheme.cyan,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Expanded(
            child: Text(
              title,
              style: GoogleFonts.spaceGrotesk(
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          ?trailing,
          if (onSeeAll != null)
            TextButton(
              onPressed: onSeeAll,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                'See all',
                style: TextStyle(color: CrickTheme.cyan, fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }
}

class CrickCard extends StatelessWidget {
  const CrickCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(12),
    this.margin,
  });
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets padding;
  final EdgeInsets? margin;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: onTap != null,
      container: true,
      child: Container(
        margin:
            margin ?? const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        child: Material(
          color: CrickTheme.bgCard,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: padding,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: CrickTheme.borderSubtle),
              ),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

class SeasonChipBar extends StatelessWidget {
  const SeasonChipBar({
    super.key,
    required this.seasons,
    required this.selected,
    required this.onChanged,
    this.includeAll = true,
  });

  final List<String> seasons;
  final String? selected;
  final ValueChanged<String?> onChanged;
  final bool includeAll;

  @override
  Widget build(BuildContext context) {
    final items = <String?>[if (includeAll) null, ...seasons.reversed];
    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: 6),
        itemBuilder: (context, i) {
          final s = items[i];
          final label = s ?? 'All';
          final selectedNow = selected == s;
          return ChoiceChip(
            label: Text(label),
            selected: selectedNow,
            visualDensity: VisualDensity.compact,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            onSelected: (_) => onChanged(s),
            selectedColor: CrickTheme.cyan.withValues(alpha: 0.18),
            labelStyle: TextStyle(
              color: selectedNow ? CrickTheme.cyan : CrickTheme.textSecondary,
              fontSize: 11,
              fontWeight: selectedNow ? FontWeight.w700 : FontWeight.w500,
            ),
            side: BorderSide(
              color: selectedNow
                  ? CrickTheme.cyan.withValues(alpha: 0.5)
                  : CrickTheme.borderSubtle,
            ),
            backgroundColor: CrickTheme.bgCard,
            padding: const EdgeInsets.symmetric(horizontal: 4),
          );
        },
      ),
    );
  }
}

class PlayerAvatar extends StatelessWidget {
  const PlayerAvatar({
    super.key,
    required this.name,
    this.size = 44,
    this.radius,
    this.borderColor,
    this.showBorder = true,
  });

  final String name;
  final double size;
  final double? radius;
  final Color? borderColor;
  final bool showBorder;

  @override
  Widget build(BuildContext context) {
    final r = radius ?? (size > 80 ? 16.0 : size / 2);
    final border = borderColor ?? CrickTheme.cyan.withValues(alpha: 0.35);
    final image = ClipRRect(
      borderRadius: BorderRadius.circular(r),
      child: AppConfig.useRemoteMedia
          ? CachedNetworkImage(
              imageUrl: AppConfig.playerImage(name),
              width: size,
              height: size,
              fit: BoxFit.cover,
              memCacheWidth: (size * 3).round().clamp(120, 900),
              memCacheHeight: (size * 3).round().clamp(120, 900),
              fadeInDuration: const Duration(milliseconds: 180),
              placeholder: (context, url) => _fallback(),
              errorWidget: (context, url, error) => _fallback(),
            )
          : _fallback(),
    );

    if (!showBorder) {
      return SizedBox(width: size, height: size, child: image);
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(r + 2),
        border: Border.all(color: border, width: size > 80 ? 2.5 : 1.5),
        boxShadow: size > 60
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.35),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: image,
    );
  }

  Widget _fallback() {
    final parts = name.trim().split(RegExp(r'\s+')).where((e) => e.isNotEmpty);
    final initials = parts.isEmpty
        ? '?'
        : parts.take(2).map((e) => e[0]).join().toUpperCase();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      color: CrickTheme.bgElevated,
      child: Text(
        initials,
        style: GoogleFonts.jetBrainsMono(
          fontSize: size * 0.28,
          fontWeight: FontWeight.w700,
          color: CrickTheme.cyan,
        ),
      ),
    );
  }
}

class TeamLogo extends StatelessWidget {
  const TeamLogo({super.key, required this.team, this.size = 36});
  final String team;
  final double size;

  @override
  Widget build(BuildContext context) {
    final url = teamLogoUrl(team);
    final color = teamColor(team);
    if (!AppConfig.useRemoteMedia || url == null) return _badge(color);
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: CachedNetworkImage(
        imageUrl: url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        memCacheWidth: (size * 3).round(),
        placeholder: (_, _) => _badge(color),
        errorWidget: (_, _, _) => _badge(color),
      ),
    );
  }

  Widget _badge(Color color) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Text(
        teamAbbr(team),
        style: GoogleFonts.jetBrainsMono(
          fontSize: size * 0.28,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

class MatchTile extends StatelessWidget {
  const MatchTile({super.key, required this.match, this.onTap});
  final Map<String, dynamic> match;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t1 = match['team1']?.toString() ?? '';
    final t2 = match['team2']?.toString() ?? '';
    return CrickCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                match['season']?.toString() ?? '',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 10,
                  color: CrickTheme.cyan,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              Text(
                formatDate(match['date']),
                style: const TextStyle(
                  fontSize: 10,
                  color: CrickTheme.textMuted,
                ),
              ),
              const SizedBox(width: 4),
              const Icon(
                Icons.chevron_right,
                size: 16,
                color: CrickTheme.textMuted,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              TeamLogo(team: t1, size: 30),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  teamAbbr(t1),
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: CrickTheme.bgElevated,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'VS',
                  style: TextStyle(
                    color: CrickTheme.textMuted,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  teamAbbr(t2),
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              TeamLogo(team: t2, size: 30),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            matchResult(match),
            style: const TextStyle(
              fontSize: 12,
              color: CrickTheme.textSecondary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class LeaderboardTile extends StatelessWidget {
  const LeaderboardTile({
    super.key,
    required this.rank,
    required this.name,
    required this.primary,
    required this.primaryLabel,
    this.secondary,
    this.onTap,
  });

  final int rank;
  final String name;
  final String primary;
  final String primaryLabel;
  final String? secondary;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return CrickCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      child: Row(
        children: [
          SizedBox(
            width: 26,
            child: Text(
              '#$rank',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 12,
                color: rank <= 3 ? CrickTheme.amber : CrickTheme.textMuted,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          PlayerAvatar(name: name, size: 44),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                if (secondary != null)
                  Text(
                    secondary!,
                    style: const TextStyle(
                      fontSize: 11,
                      color: CrickTheme.textMuted,
                    ),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                primary,
                style: GoogleFonts.jetBrainsMono(
                  fontWeight: FontWeight.w700,
                  color: CrickTheme.cyan,
                  fontSize: 15,
                ),
              ),
              Text(
                primaryLabel,
                style: const TextStyle(
                  fontSize: 10,
                  color: CrickTheme.textMuted,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class ShimmerList extends StatelessWidget {
  const ShimmerList({super.key, this.count = 6});
  final int count;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: CrickTheme.bgCard,
      highlightColor: CrickTheme.bgElevated,
      child: ListView.builder(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        itemCount: count,
        itemBuilder: (_, _) => Container(
          height: 60,
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: CrickTheme.bgCard,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }
}

class SearchField extends StatelessWidget {
  const SearchField({
    super.key,
    required this.controller,
    required this.hint,
    this.onChanged,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String hint;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      style: const TextStyle(color: CrickTheme.textPrimary, fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        isDense: true,
        prefixIcon: const Icon(
          Icons.search,
          color: CrickTheme.textMuted,
          size: 20,
        ),
        suffixIcon: controller.text.isEmpty
            ? null
            : IconButton(
                tooltip: 'Clear search',
                icon: const Icon(
                  Icons.clear,
                  color: CrickTheme.textMuted,
                  size: 18,
                ),
                onPressed: () {
                  controller.clear();
                  onChanged?.call('');
                },
              ),
      ),
    );
  }
}

class KeyValueRow extends StatelessWidget {
  const KeyValueRow(this.label, this.value, {super.key, this.accent = false});
  final String label;
  final String value;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: CrickTheme.textSecondary,
                fontSize: 13,
              ),
            ),
          ),
          Text(
            value,
            style: GoogleFonts.jetBrainsMono(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: accent ? CrickTheme.cyan : CrickTheme.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
