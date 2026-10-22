namespace DesignPatterns.Content.Tests;

/// <summary>Learner code and CheckContext/Console are process-global, so tests that run it must not overlap.</summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public class ConsoleCaptureCollection { public const string Name = "ConsoleCapture"; }
