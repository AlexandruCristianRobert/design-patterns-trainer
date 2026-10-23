namespace DesignPatterns.Ide;

/// <summary>Converts between Monaco 1-based line/column and 0-based text offsets. Handles CRLF, LF and CR.</summary>
public static class Positions
{
    public static int ToOffset(string text, int line1, int column1)
    {
        var line = 1;
        var i = 0;
        while (line < line1 && i < text.Length)
        {
            var c = text[i++];
            if (c == '\r' && i < text.Length && text[i] == '\n') i++;
            if (c == '\r' || c == '\n') line++;
        }
        if (line < line1) return text.Length;

        var lineStart = i;
        var lineEnd = lineStart;
        while (lineEnd < text.Length && text[lineEnd] != '\r' && text[lineEnd] != '\n') lineEnd++;
        return Math.Min(lineStart + Math.Max(column1 - 1, 0), lineEnd);
    }

    public static (int Line1, int Column1) ToLineColumn(string text, int offset)
    {
        offset = Math.Clamp(offset, 0, text.Length);
        var line = 1;
        var lineStart = 0;
        for (var i = 0; i < offset; i++)
        {
            var c = text[i];
            if (c == '\r' && i + 1 < text.Length && text[i + 1] == '\n')
            {
                if (i + 1 >= offset) break; // offset sits between \r and \n: stay on this line
                i++;
            }
            if (c == '\r' || c == '\n')
            {
                line++;
                lineStart = i + 1;
            }
        }
        return (line, offset - lineStart + 1);
    }
}
