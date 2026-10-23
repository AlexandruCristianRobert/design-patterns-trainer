using DesignPatterns.Core.Contracts;

namespace DesignPatterns.Content.Tests;

public sealed record ExerciseFiles(string PatternId, string ExerciseId, string Kind, int Version, Contract Contract,
    string Starter, string Solution, string Checks, IReadOnlyDictionary<string, string> TextEnPathsByLocale,
    IReadOnlyList<string>? LoadErrors = null);

public sealed record ExamQuestionFiles(string PatternId, string QuestionId, int Version, Contract Contract,
    string Solution, string Checks, IReadOnlyDictionary<string, string> TextEnPathsByLocale,
    IReadOnlyList<string> RoleNames, string PatternName, IReadOnlyList<string>? LoadErrors = null);
