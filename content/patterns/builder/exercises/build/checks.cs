using System.Reflection;
using System.Runtime.CompilerServices;
using DesignPatterns.Checks;

static class QueryChecks
{
    // Calls a step on the builder. A step may return nothing or the builder, so both styles pass.
    static void Step(QueryBuilder builder, string name, object arg)
    {
        var method = typeof(QueryBuilder).GetMethods(BindingFlags.Instance | BindingFlags.Public).FirstOrDefault(m =>
            m.Name == name && m.GetParameters() is [var p] && p.ParameterType == arg.GetType());
        var shown = $"{name}({(arg is int ? "int" : "string")})";
        if (method is null) Expect.Fail("missingStep", new { step = shown });
        try
        {
            method.Invoke(builder, [arg]);
        }
        catch (TargetInvocationException e)
        {
            Expect.Fail("stepThrew", new { step = shown, message = e.InnerException?.Message });
        }
    }

    // A builder for the table with the steps applied in turn, each written as a name followed by its argument.
    static QueryBuilder Query(string table, params object[] steps)
    {
        var builder = new QueryBuilder(table);
        for (var i = 0; i < steps.Length; i += 2)
            Step(builder, (string)steps[i], steps[i + 1]);
        return builder;
    }

    // "rejected" when Build() throws an InvalidOperationException, otherwise the SQL.
    static string Outcome(QueryBuilder builder)
    {
        try { return builder.Build().ToSql(); }
        catch (InvalidOperationException) { return "rejected"; }
    }

    [Check("steps-write-the-sql")]
    static void StepsWriteTheSql()
    {
        var full = Outcome(Query("toys", "Select", "name", "Select", "price", "Where", "price < 20", "Where", "stock > 0",
            "OrderBy", "price", "Limit", 5));
        var bare = Outcome(Query("toys"));
        var ordered = Outcome(Query("games", "OrderBy", "title"));

        Expect.That(full == "SELECT name, price FROM toys WHERE price < 20 AND stock > 0 ORDER BY price LIMIT 5", "wrongFull", new { actual = full });
        Expect.That(bare == "SELECT * FROM toys", "wrongBare", new { actual = bare });
        Expect.That(ordered == "SELECT * FROM games ORDER BY title", "wrongOrdered", new { actual = ordered });
    }

    [Check("steps-in-any-order")]
    static void StepsInAnyOrder()
    {
        var scrambled = Outcome(Query("toys", "Limit", 5, "Where", "price < 20", "OrderBy", "price", "Select", "name",
            "Where", "stock > 0", "Select", "price"));
        var replaced = Outcome(Query("toys", "OrderBy", "name", "Limit", 9, "OrderBy", "price", "Limit", 2));

        Expect.That(scrambled == "SELECT name, price FROM toys WHERE price < 20 AND stock > 0 ORDER BY price LIMIT 5", "wrongScrambled", new { actual = scrambled });
        Expect.That(replaced == "SELECT * FROM toys ORDER BY price LIMIT 2", "wrongReplaced", new { actual = replaced });
    }

    [Check("build-rejects-limit-without-order")]
    static void BuildRejectsLimitWithoutOrder()
    {
        var unordered = Outcome(Query("toys", "Where", "stock > 0", "Limit", 3));
        var zero = Outcome(Query("toys", "OrderBy", "price", "Limit", 0));
        var one = Outcome(Query("toys", "Limit", 1, "OrderBy", "price"));

        Expect.That(unordered == "rejected", "unorderedAccepted", new { actual = unordered });
        Expect.That(zero == "rejected", "zeroAccepted", new { actual = zero });
        Expect.That(one == "SELECT * FROM toys ORDER BY price LIMIT 1", "oneRejected", new { actual = one });
    }

    [Check("later-steps-leave-queries-alone")]
    static void LaterStepsLeaveQueriesAlone()
    {
        var builder = Query("toys", "Select", "name", "Where", "price < 20");
        var first = builder.Build();
        Step(builder, "Select", "price");
        Step(builder, "Where", "stock > 0");
        Step(builder, "OrderBy", "price");
        var second = builder.Build();

        Expect.That(first.ToSql() == "SELECT name FROM toys WHERE price < 20", "firstChanged", new { actual = first.ToSql() });
        Expect.That(second.ToSql() == "SELECT name, price FROM toys WHERE price < 20 AND stock > 0 ORDER BY price", "wrongSecond", new { actual = second.ToSql() });
    }

    [Check("recipe-uses-the-given-builder")]
    static void RecipeUsesTheGivenBuilder()
    {
        var builder = Query("games", "Select", "title");
        Reports.CheapestInStock(builder, 3);
        Step(builder, "Where", "players >= 4");
        var sql = Outcome(builder);

        Expect.That(sql == "SELECT title FROM games WHERE stock > 0 AND players >= 4 ORDER BY price LIMIT 3", "wrongRecipe", new { actual = sql });
    }

    [Check("queries-come-only-from-the-builder")]
    static void QueriesComeOnlyFromTheBuilder()
    {
        var type = typeof(SqlQuery);
        Expect.That(type.GetConstructors(BindingFlags.Instance | BindingFlags.Public).Length == 0, "publicConstructor");

        var setter = type.GetProperties(BindingFlags.Instance | BindingFlags.Public)
            .FirstOrDefault(p => p.SetMethod is { IsPublic: true } s &&
                !s.ReturnParameter.GetRequiredCustomModifiers().Contains(typeof(IsExternalInit)));
        Expect.That(setter is null, "publicSetter", new { member = setter?.Name });

        var field = type.GetFields(BindingFlags.Instance | BindingFlags.Public).FirstOrDefault(f => !f.IsInitOnly);
        Expect.That(field is null, "publicField", new { member = field?.Name });
    }
}
