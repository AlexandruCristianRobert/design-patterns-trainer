using System.Reflection;
using System.Reflection.Metadata;
using Microsoft.CodeAnalysis;

namespace DesignPatterns.Core;

public static unsafe class LoadedMetadata
{
    /// <summary>Builds a reference from the metadata already mapped in memory; needs no file path (WebAssembly-safe).</summary>
    public static MetadataReference For(Assembly loaded)
    {
        if (!loaded.TryGetRawMetadata(out var blob, out var length))
            throw new InvalidOperationException($"No raw metadata available for {loaded.FullName}");
        return AssemblyMetadata.Create(ModuleMetadata.CreateFromMetadata((IntPtr)blob, length)).GetReference();
    }
}
