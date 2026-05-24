import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_math_fork/flutter_math.dart';

import '../theme/delt_theme.dart';

class MessageRenderer extends StatelessWidget {
  const MessageRenderer({super.key, required this.content});
  final String content;

  @override
  Widget build(BuildContext context) {
    final processed = _preprocessLatex(_normalizeTables(content));
    final segments = _segment(processed);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final segment in segments) ...[
          if (segment is _MarkdownSegment)
            _MarkdownBlock(data: segment.text)
          else if (segment is _MathSegment)
            _MathBlock(tex: segment.tex)
          else if (segment is _TableSegment)
            _TableBlock(table: segment),
          if (segment != segments.last) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class ThinkingBlock extends StatelessWidget {
  const ThinkingBlock({
    super.key,
    required this.reasoning,
    required this.streaming,
  });

  final String reasoning;
  final bool streaming;

  @override
  Widget build(BuildContext context) {
    if (reasoning.trim().isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: DeltColors.surface,
        border: Border.all(color: DeltColors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 12),
          childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          initiallyExpanded: streaming,
          leading: const Icon(
            Icons.psychology_alt_rounded,
            size: 18,
            color: DeltColors.muted,
          ),
          title: Text(
            streaming ? 'Raisonnement en cours...' : 'Raisonnement',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
          ),
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                reasoning,
                style: const TextStyle(
                  color: DeltColors.muted,
                  fontSize: 12,
                  height: 1.35,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MarkdownBlock extends StatelessWidget {
  const _MarkdownBlock({required this.data});
  final String data;

  @override
  Widget build(BuildContext context) {
    if (data.trim().isEmpty) return const SizedBox.shrink();
    if (_hasInlineMath(data)) return _InlineMathMarkdownBlock(data: data);
    return MarkdownBody(
      data: data,
      selectable: true,
      softLineBreak: true,
      styleSheet: MarkdownStyleSheet(
        p: const TextStyle(color: DeltColors.text, height: 1.38, fontSize: 15),
        h1: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
        h2: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
        h3: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
        strong: const TextStyle(fontWeight: FontWeight.w900),
        blockquote: const TextStyle(color: DeltColors.muted, height: 1.35),
        code: const TextStyle(
          color: DeltColors.accent,
          backgroundColor: DeltColors.surface,
          fontFamily: 'monospace',
          fontSize: 13,
        ),
        codeblockDecoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: DeltColors.border),
          borderRadius: BorderRadius.circular(12),
        ),
        codeblockPadding: const EdgeInsets.all(12),
        listBullet: const TextStyle(color: DeltColors.text, fontSize: 15),
        tableBorder: TableBorder.all(color: Colors.transparent),
      ),
    );
  }
}

class _InlineMathMarkdownBlock extends StatelessWidget {
  const _InlineMathMarkdownBlock({required this.data});
  final String data;

  @override
  Widget build(BuildContext context) {
    final children = <Widget>[];
    final buffer = StringBuffer();
    var inCodeFence = false;

    void flushMarkdown() {
      final text = buffer.toString().trimRight();
      if (text.trim().isNotEmpty) children.add(_MarkdownBlock(data: text));
      buffer.clear();
    }

    for (final line in data.split('\n')) {
      if (line.trimLeft().startsWith('```')) {
        inCodeFence = !inCodeFence;
        buffer.writeln(line);
        continue;
      }
      if (inCodeFence || !_hasInlineMath(line)) {
        buffer.writeln(line);
        continue;
      }
      flushMarkdown();
      children.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: _InlineMathText(text: line, header: false),
        ),
      );
    }
    flushMarkdown();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final child in children) ...[
          child,
          if (child != children.last) const SizedBox(height: 4),
        ],
      ],
    );
  }
}

class _MathBlock extends StatelessWidget {
  const _MathBlock({required this.tex});
  final String tex;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Math.tex(
          tex.trim(),
          textStyle: const TextStyle(fontSize: 16, color: DeltColors.text),
          mathStyle: MathStyle.display,
          onErrorFallback: (error) => Text(
            tex,
            style: const TextStyle(color: Colors.red, fontFamily: 'monospace'),
          ),
        ),
      ),
    );
  }
}

bool _hasInlineMath(String value) {
  return RegExp(r'(^|[^\\])\$[^$\n]+\$').hasMatch(value);
}

class _TableBlock extends StatelessWidget {
  const _TableBlock({required this.table});
  final _TableSegment table;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: DeltColors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      clipBehavior: Clip.antiAlias,
      child: Scrollbar(
        thumbVisibility: true,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            headingRowColor: WidgetStateProperty.all(DeltColors.surface),
            columnSpacing: 22,
            horizontalMargin: 14,
            columns: [
              for (final cell in table.header)
                DataColumn(
                  label: _TableCellContent(cell: cell, header: true),
                ),
            ],
            rows: [
              for (final row in table.rows)
                DataRow(
                  cells: [
                    for (var i = 0; i < table.header.length; i++)
                      DataCell(
                        ConstrainedBox(
                          constraints: const BoxConstraints(
                            minWidth: 120,
                            maxWidth: 320,
                          ),
                          child: _TableCellContent(
                            cell: i < row.length ? row[i] : '',
                          ),
                        ),
                      ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TableCellContent extends StatelessWidget {
  const _TableCellContent({required this.cell, this.header = false});
  final String cell;
  final bool header;

  @override
  Widget build(BuildContext context) {
    final text = cell.trim();
    if (text.contains(r'$')) {
      return _InlineMathText(text: text, header: header);
    }
    return MarkdownBody(
      data: text,
      selectable: true,
      softLineBreak: true,
      styleSheet: MarkdownStyleSheet(
        p: TextStyle(
          color: header ? DeltColors.muted : DeltColors.text,
          fontSize: header ? 12 : 13,
          fontWeight: header ? FontWeight.w900 : FontWeight.w500,
          height: 1.25,
        ),
        strong: const TextStyle(fontWeight: FontWeight.w900),
        code: const TextStyle(
          color: DeltColors.accent,
          backgroundColor: DeltColors.surface,
          fontFamily: 'monospace',
          fontSize: 12,
        ),
      ),
    );
  }
}

class _InlineMathText extends StatelessWidget {
  const _InlineMathText({required this.text, required this.header});
  final String text;
  final bool header;

  @override
  Widget build(BuildContext context) {
    final spans = <InlineSpan>[];
    final pattern = RegExp(r'\$([^$]+)\$');
    var index = 0;
    for (final match in pattern.allMatches(text)) {
      if (match.start > index) {
        spans.add(
          TextSpan(
            text: text.substring(index, match.start),
            style: _style,
          ),
        );
      }
      final tex = match.group(1) ?? '';
      spans.add(
        WidgetSpan(
          alignment: PlaceholderAlignment.middle,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: Math.tex(
              tex,
              textStyle: TextStyle(
                fontSize: header ? 12 : 13,
                color: header ? DeltColors.muted : DeltColors.text,
              ),
              onErrorFallback: (_) => Text('\$$tex\$', style: _style),
            ),
          ),
        ),
      );
      index = match.end;
    }
    if (index < text.length) {
      spans.add(TextSpan(text: text.substring(index), style: _style));
    }
    return RichText(text: TextSpan(children: spans, style: _style));
  }

  TextStyle get _style => TextStyle(
    color: header ? DeltColors.muted : DeltColors.text,
    fontSize: header ? 12 : 13,
    fontWeight: header ? FontWeight.w900 : FontWeight.w500,
    height: 1.25,
  );
}

String _preprocessLatex(String value) {
  return value
      .replaceAllMapped(
        RegExp(r'\\\[\s*([\s\S]*?)\s*\\\]'),
        (m) => '\$\$\n${m.group(1)!.trim()}\n\$\$',
      )
      .replaceAllMapped(
        RegExp(r'\\\(\s*([\s\S]*?)\s*\\\)'),
        (m) => '\$${m.group(1)!.trim()}\$',
      );
}

String _normalizeTables(String value) {
  final lines = value.split('\n');
  final out = <String>[];
  final separator = RegExp(r'\|\s*:?-{2,}:?\s*\|');
  for (final raw in lines) {
    var line = raw;
    final pipeCount = '|'.allMatches(line).length;
    if (separator.hasMatch(line) && pipeCount >= 6) {
      final firstPipe = line.indexOf('|');
      final prefix = line.substring(0, firstPipe).trimRight();
      var tablePart = line.substring(firstPipe);
      tablePart = tablePart.replaceAll(RegExp(r'\|\s*\|'), '|\n|');
      if (prefix.isNotEmpty) {
        out
          ..add(prefix)
          ..add('');
      } else if (out.isNotEmpty && out.last.trim().isNotEmpty) {
        out.add('');
      }
      out.addAll(tablePart.split('\n').map((l) => l.trimRight()));
    } else {
      out.add(line);
    }
  }
  return out.join('\n');
}

List<_Segment> _segment(String value) {
  final lines = value.split('\n');
  final segments = <_Segment>[];
  final markdown = StringBuffer();

  void flushMarkdown() {
    final text = markdown.toString().trimRight();
    if (text.trim().isNotEmpty) segments.add(_MarkdownSegment(text));
    markdown.clear();
  }

  for (var i = 0; i < lines.length; i++) {
    final line = lines[i];
    if (line.trim() == r'$$') {
      flushMarkdown();
      final math = StringBuffer();
      i++;
      while (i < lines.length && lines[i].trim() != r'$$') {
        math.writeln(lines[i]);
        i++;
      }
      segments.add(_MathSegment(math.toString()));
      continue;
    }

    if (_isTableStart(lines, i)) {
      flushMarkdown();
      final tableLines = <String>[];
      while (i < lines.length && lines[i].trimLeft().startsWith('|')) {
        tableLines.add(lines[i]);
        i++;
      }
      i--;
      segments.add(_parseTable(tableLines));
      continue;
    }

    markdown.writeln(line);
  }
  flushMarkdown();
  return segments;
}

bool _isTableStart(List<String> lines, int index) {
  if (index + 1 >= lines.length) return false;
  return lines[index].trimLeft().startsWith('|') &&
      RegExp(r'^\s*\|?\s*:?-{2,}:?\s*\|').hasMatch(lines[index + 1]);
}

_TableSegment _parseTable(List<String> lines) {
  List<String> cells(String line) {
    var clean = line.trim();
    if (clean.startsWith('|')) clean = clean.substring(1);
    if (clean.endsWith('|')) clean = clean.substring(0, clean.length - 1);
    return clean.split('|').map((cell) => cell.trim()).toList();
  }

  final header = lines.isEmpty ? <String>[] : cells(lines.first);
  final rows = lines.skip(2).map(cells).toList();
  return _TableSegment(header, rows);
}

sealed class _Segment {}

class _MarkdownSegment extends _Segment {
  _MarkdownSegment(this.text);
  final String text;
}

class _MathSegment extends _Segment {
  _MathSegment(this.tex);
  final String tex;
}

class _TableSegment extends _Segment {
  _TableSegment(this.header, this.rows);
  final List<String> header;
  final List<List<String>> rows;
}
