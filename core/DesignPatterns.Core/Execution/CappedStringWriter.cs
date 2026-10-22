using System.Text;

namespace DesignPatterns.Core.Execution;

/// <summary>Buffers up to <c>capacity</c> chars and silently drops the rest.</summary>
public sealed class CappedStringWriter(int capacity) : TextWriter
{
    private readonly StringBuilder _buffer = new();

    public bool Truncated { get; private set; }
    public override Encoding Encoding => Encoding.UTF8;

    public override void Write(char value) => Append([value]);
    public override void Write(string? value) { if (value is not null) Append(value); }
    public override void Write(char[] buffer, int index, int count) => Append(buffer.AsSpan(index, count));
    public override void Write(ReadOnlySpan<char> buffer) => Append(buffer);
    public override void WriteLine(string? value) { Write(value); Write(CoreNewLine); }
    public override void WriteLine(ReadOnlySpan<char> buffer) { Append(buffer); Append(CoreNewLine); }

    public override string ToString() => _buffer.ToString();

    private void Append(ReadOnlySpan<char> text)
    {
        var room = capacity - _buffer.Length;
        if (text.Length > room) Truncated = true;
        if (room > 0) _buffer.Append(text[..Math.Min(room, text.Length)]);
    }
}
