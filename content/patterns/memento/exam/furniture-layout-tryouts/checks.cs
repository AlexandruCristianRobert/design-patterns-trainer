using System.Reflection;
using DesignPatterns.Checks;

static class FurnitureTryoutChecks
{
    static void Step(RoomPlan plan, Action change, string said, string expected)
    {
        change();
        var actual = plan.Show();
        Expect.That(actual == expected, "wrongRoom", new { step = said, expected, actual });
    }

    [Check("the-plan-places-moves-and-removes")]
    static void ThePlanPlacesMovesAndRemoves()
    {
        var plan = new RoomPlan();
        Step(plan, () => { }, "making a new plan", "empty room");
        Step(plan, () => { plan.Place("sofa", 0, 0); plan.Place("armchair", 2, 3); }, "placing a sofa at 0,0 and an armchair at 2,3", "armchair 2,3; sofa 0,0");
        Step(plan, () => plan.Place("sofa", 5, 1), "then placing the sofa at 5,1", "armchair 2,3; sofa 5,1");
        Step(plan, () => { plan.Remove("armchair"); plan.Remove("piano"); }, "then removing the armchair and a piano that is not there", "sofa 5,1");
    }

    [Check("put-back-brings-back-the-room-as-the-tryout-found-it")]
    static void PutBackBringsBackTheRoom()
    {
        var plan = new RoomPlan();
        plan.Place("table", 2, 2);
        plan.Place("rug", 1, 1);
        var tryout = new Tryout(plan);
        plan.Place("table", 4, 0);
        plan.Remove("rug");
        plan.Place("plant", 0, 4);
        Step(plan, tryout.PutBack, "starting a tryout, moving the table, removing the rug, adding a plant and putting back", "rug 1,1; table 2,2");
        plan.Place("rug", 3, 3);
        plan.Place("chair", 1, 0);
        Step(plan, tryout.PutBack, "then changing the room again and putting back again", "rug 1,1; table 2,2");
    }

    [Check("keep-changes-starts-from-the-room-as-it-is")]
    static void KeepChangesStartsFromTheRoomAsItIs()
    {
        var plan = new RoomPlan();
        plan.Place("desk", 0, 0);
        var tryout = new Tryout(plan);
        plan.Place("desk", 2, 0);
        plan.Place("shelf", 3, 3);
        tryout.KeepChanges();
        plan.Remove("shelf");
        plan.Place("desk", 9, 9);
        Step(plan, tryout.PutBack, "moving things, keeping the changes, changing more and putting back", "desk 2,0; shelf 3,3");
    }

    [Check("a-saved-look-stays-as-it-was")]
    static void ASavedLookStaysAsItWas()
    {
        var plan = new RoomPlan();
        plan.Place("bed", 1, 2);
        plan.Place("chest", 0, 5);
        var look = plan.Save();
        plan.Place("bed", 3, 3);
        plan.Remove("chest");
        Step(plan, () => plan.Restore(look), "saving, moving the bed, removing the chest and restoring", "bed 1,2; chest 0,5");
        plan.Place("chest", 6, 6);
        plan.Place("cot", 2, 2);
        Step(plan, () => plan.Restore(look), "then changing the restored room and restoring the same look again", "bed 1,2; chest 0,5");
    }

    [Check("nothing-else-can-read-a-saved-look")]
    static void NothingElseCanReadASavedLook()
    {
        var plan = new RoomPlan();
        plan.Place("sofa", 0, 0);
        ExpectNothingPublicInside(plan.Save());
    }

    [Check("the-plan-keeps-its-furniture-to-itself")]
    static void ThePlanKeepsItsFurnitureToItself() => ExpectKeepsItsOwn(typeof(RoomPlan));

    // ---- Nothing outside reads a saved copy ----

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // No type of ours that the saved copy is (its own class or record, a class it inherits from, or an interface it
    // implements) is public all the way out and has a public field (constants aside) or a public property. A private
    // or internal type, or one nested in such a type, may have public members: code outside cannot name it.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(RoomPlan).Assembly;
        var type = saved.GetType();
        Expect.That(type.Assembly == ours, "notOurs", new { type = type.Name });
        var types = new List<Type>();
        for (var t = type; t is not null && t.Assembly == ours; t = t.BaseType) types.Add(t);
        types.AddRange(type.GetInterfaces().Where(i => i.Assembly == ours));
        foreach (var t in types.Where(t => t.IsVisible))
        {
            foreach (var field in t.GetFields(Declared).Where(f => f.IsPublic && !f.IsLiteral))
                Expect.Fail("publicInside", new { type = t.Name, member = field.Name });
            foreach (var property in t.GetProperties(Declared).Where(p => p.GetMethod?.IsPublic == true || p.SetMethod?.IsPublic == true))
                Expect.Fail("publicInside", new { type = t.Name, member = property.Name });
        }
    }

    // ---- The class keeps what it holds to itself ----

    // Neither the class nor a class of ours it inherits from has a public field (constants aside) or a public property
    // with a public set or init.
    static void ExpectKeepsItsOwn(Type owner)
    {
        for (var t = owner; t is not null && t.Assembly == owner.Assembly; t = t.BaseType)
        {
            foreach (var field in t.GetFields(Declared).Where(f => f.IsPublic && !f.IsLiteral))
                Expect.Fail("publicField", new { type = owner.Name, field = field.Name });
            foreach (var property in t.GetProperties(Declared).Where(p => p.SetMethod?.IsPublic == true))
                Expect.Fail("publicSetter", new { type = owner.Name, property = property.Name });
        }
    }
}
