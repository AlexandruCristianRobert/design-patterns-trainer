using System.Reflection;
using DesignPatterns.Checks;

static class FarmTileChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    static readonly Ground[] Grounds = [Ground.Grass, Ground.Soil, Ground.Water];

    // Every instance field of `type` and of its base classes.
    static IEnumerable<FieldInfo> Fields(Type type)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            foreach (var f in t.GetFields(Declared)) yield return f;
    }

    // A field's name as the learner wrote it: "Colour" for the field behind the Colour property.
    static string Shown(FieldInfo f) => f.Name.StartsWith('<') ? f.Name[1..f.Name.IndexOf('>')] : f.Name;

    // The first field that could still be assigned after the object is made. The compiler's fields for captured
    // primary-constructor parameters are skipped; the "unchanged by use" part catches a class that assigns one.
    static FieldInfo? Writable(Type type) => Fields(type).FirstOrDefault(f => !f.IsInitOnly && !f.Name.EndsWith(">P"));

    static object?[] Snapshot(object o) => Fields(o.GetType()).Select(f => f.GetValue(o)).ToArray();

    // A new GroundLooks, made through its public constructor without parameters.
    static object NewLooks()
    {
        var ctor = Code.Type("GroundLooks").Clr.GetConstructor(Type.EmptyTypes);
        if (ctor is null) Expect.Fail("noLooksConstructor");
        return ctor.Invoke(null);
    }

    // What looks.Get(ground) returns.
    static object GetLook(object looks, Ground ground)
    {
        var get = looks.GetType().GetMethod("Get", [typeof(Ground)]);
        if (get is null || get.ReturnType != Code.Type("GroundLook").Clr) Expect.Fail("noGet");
        return get.Invoke(looks, [ground])!;
    }

    // A new Field, made through its public constructor that takes a GroundLooks.
    static Field NewField(object looks)
    {
        var ctor = typeof(Field).GetConstructor([looks.GetType()]);
        if (ctor is null) Expect.Fail("noFieldConstructor");
        return (Field)ctor.Invoke([looks]);
    }

    // What field.LookAt(index) returns.
    static object LookAt(Field field, int index)
    {
        var lookAt = typeof(Field).GetMethod("LookAt", [typeof(int)]);
        if (lookAt is null || lookAt.ReturnType != Code.Type("GroundLook").Clr) Expect.Fail("noLookAt");
        return lookAt.Invoke(field, [index])!;
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected = [",,#~", "##~~", "grass , (green) at 0,0", "water ~ (blue) at 3,1"];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("same-ground-same-look")]
    static void SameGroundSameLook()
    {
        Expect.That(!Code.Type("GroundLook").Clr.IsValueType, "lookNotClass");
        var looks = NewLooks();
        Expect.That(ReferenceEquals(GetLook(looks, Ground.Grass), GetLook(looks, Ground.Grass)), "notShared");

        var got = Grounds.Select(g => GetLook(looks, g)).ToArray();
        for (var i = 0; i < got.Length; i++)
            for (var j = i + 1; j < got.Length; j++)
                Expect.That(!ReferenceEquals(got[i], got[j]), "sameForTwo", new { first = Grounds[i], second = Grounds[j] });
    }

    [Check("field-shares-the-looks")]
    static void FieldSharesTheLooks()
    {
        var looks = NewLooks();
        var field = NewField(looks);
        for (var i = 0; i < 30; i++)
            field.Lay(i % 10, i / 10, Grounds[i % 3]);

        for (var i = 0; i < 30; i++)
            Expect.That(ReferenceEquals(LookAt(field, i), GetLook(looks, Grounds[i % 3])), "notFromLooks", new { index = i, ground = Grounds[i % 3] });

        (int Index, string Expected)[] draws = [(0, "grass , (green) at 0,0"), (13, "soil # (brown) at 3,1"), (29, "water ~ (blue) at 9,2")];
        foreach (var (index, expected) in draws)
        {
            var actual = field.Draw(index);
            Expect.That(actual == expected, "wrongDraw", new { index, actual, expected });
        }
        var row = field.Row(2);
        Expect.That(row == "~,#~,#~,#~", "wrongRow", new { expected = "~,#~,#~,#~", actual = row });
    }

    [Check("look-never-changes")]
    static void LookNeverChanges()
    {
        var writable = Writable(Code.Type("GroundLook").Clr);
        Expect.That(writable is null, "writableField", new { field = writable is null ? "" : Shown(writable) });

        var looks = NewLooks();
        var water = GetLook(looks, Ground.Water);
        var before = Snapshot(water);
        var field = NewField(looks);
        field.Lay(5, 6, Ground.Water);
        field.Lay(70, 80, Ground.Water);
        field.Draw(0);
        field.Draw(1);
        Expect.That(before.SequenceEqual(Snapshot(water)), "changedByUse");
    }
}
