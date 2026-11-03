var card = new ProfileCard();
Console.WriteLine(card.Picture(new Member("Ana", "ana-beach.jpg", "PhotoHub")));
Console.WriteLine(card.Picture(new Member("Ana", "", "PhotoHub")));
Console.WriteLine(card.Picture(new Member("ana", "", "")));
Console.WriteLine(card.Picture(new Member("", "", "")));

// A forum member: an uploaded photo and a linked site are the empty string when the member has none.
public record Member(string Name, string Upload, string LinkedSite);

// Every place a profile picture can come from.
public interface PictureSource
{
    string PictureOf(Member member);
}

// Each source is created on its own; Then sets the source after it.
public class UploadedPhoto : PictureSource
{
    private PictureSource? next;

    public void Then(PictureSource next) => this.next = next;

    public string PictureOf(Member member) =>
        member.Upload != "" ? $"photo {member.Upload}" : next?.PictureOf(member) ?? "grey outline";
}

public class LinkedSitePhoto : PictureSource
{
    private PictureSource? next;

    public void Then(PictureSource next) => this.next = next;

    public string PictureOf(Member member) =>
        member.LinkedSite != "" ? $"{member.LinkedSite} picture of {member.Name}" : next?.PictureOf(member) ?? "grey outline";
}

public class NameInitial : PictureSource
{
    private PictureSource? next;

    public void Then(PictureSource next) => this.next = next;

    public string PictureOf(Member member)
    {
        var name = member.Name.Trim();
        return name != "" ? $"letter {char.ToUpperInvariant(name[0])}" : next?.PictureOf(member) ?? "grey outline";
    }
}

// The card puts the sources in line once and keeps only the first.
public class ProfileCard
{
    private readonly PictureSource first;

    public ProfileCard()
    {
        var upload = new UploadedPhoto();
        var linked = new LinkedSitePhoto();
        upload.Then(linked);
        linked.Then(new NameInitial());
        first = upload;
    }

    public string Picture(Member member) => first.PictureOf(member);
}
