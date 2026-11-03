// The album hands out a walker. The walker remembers where it is, so no client repeats the loops.
using System.Collections;

var album = new CoinAlbum(
[
    [new Coin("Italy", 1999, 50), null, new Coin("France", 2001, 20)],
    [null, new Coin("Italy", 2005, 100)],
    [new Coin("Spain", 2010, 200), new Coin("France", 2015, 10), null],
]);

AlbumPrinter.Print(album);
Console.WriteLine($"total: {ValueCounter.Total(album)}c");

var a = album.CreateWalker();
var b = album.CreateWalker();
a.MoveNext();
a.MoveNext();
b.MoveNext();
Console.WriteLine($"a is at {a.Current}, b is at {b.Current}");

public record Coin(string Country, int Year, int Cents)
{
    public override string ToString() => $"{Country} {Year}";
}

public class CoinAlbum(Coin?[][] pages) : IEnumerable<Coin>
{
    public AlbumWalker CreateWalker() => new(pages);

    public IEnumerator<Coin> GetEnumerator()
    {
        foreach (var page in pages)
            foreach (var pocket in page)
                if (pocket is not null)
                    yield return pocket;
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

public class AlbumWalker(Coin?[][] pages) : IEnumerator<Coin>
{
    private int page;
    private int pocket = -1;

    public Coin Current { get; private set; } = null!;
    object IEnumerator.Current => Current;

    public bool MoveNext()
    {
        while (page < pages.Length)
        {
            pocket++;
            if (pocket >= pages[page].Length)
            {
                page++;
                pocket = -1;
            }
            else if (pages[page][pocket] is { } coin)
            {
                Current = coin;
                return true;
            }
        }
        return false;
    }

    public void Reset()
    {
        page = 0;
        pocket = -1;
    }

    public void Dispose() { }
}

public static class AlbumPrinter
{
    public static void Print(CoinAlbum album)
    {
        var walker = album.CreateWalker();
        while (walker.MoveNext())
            Console.WriteLine($"{walker.Current}, {walker.Current.Cents}c");
    }
}

public static class ValueCounter
{
    public static int Total(CoinAlbum album)
    {
        var total = 0;
        foreach (var coin in album)
            total += coin.Cents;
        return total;
    }
}
