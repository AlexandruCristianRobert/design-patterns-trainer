List<int> photos = [100, 301];

foreach (var archiver in new Archiver[] { new ZipArchiver(), new GzipArchiver(), new TarArchiver() })
    Console.WriteLine($"{archiver.Pack("photos", photos)}; a 1000-byte file would take {archiver.Estimate(1000)}");

public interface ICompressor
{
    // The file name extension of the archive, without the dot.
    string Extension { get; }

    // The size of a file of `bytes` bytes once it is compressed.
    int Compress(int bytes);
}

public class ZipCompressor : ICompressor
{
    public string Extension => "zip";
    public int Compress(int bytes) => bytes / 2;
}

public class GzipCompressor : ICompressor
{
    public string Extension => "tar.gz";
    public int Compress(int bytes) => bytes * 2 / 5;
}

public class NoCompressor : ICompressor
{
    public string Extension => "tar";
    public int Compress(int bytes) => bytes;
}

public abstract class Archiver
{
    // Each archiver decides which compressor it uses.
    public abstract ICompressor CreateCompressor();

    public string Pack(string name, List<int> fileSizes)
    {
        var compressor = CreateCompressor();
        var packed = fileSizes.Sum(compressor.Compress);
        return $"{name}.{compressor.Extension}: {fileSizes.Sum()} -> {packed} bytes";
    }

    public int Estimate(int bytes) => CreateCompressor().Compress(bytes);
}

public class ZipArchiver : Archiver
{
    public override ICompressor CreateCompressor() => new ZipCompressor();
}

public class GzipArchiver : Archiver
{
    public override ICompressor CreateCompressor() => new GzipCompressor();
}

public class TarArchiver : Archiver
{
    public override ICompressor CreateCompressor() => new NoCompressor();
}
