using DesignPatterns.Checks;

static class StockPhotoChecks
{
    // All Checks share one load of the program, so FullPhoto.Loaded may already be above 0 when a Check starts.
    // Each Check therefore counts only the photos loaded while it runs.

    [Check("previews-load-nothing")]
    static void PreviewsLoadNothing()
    {
        var before = FullPhoto.Loaded;
        var page = new SearchPage([new PhotoListing("red fox", true), new PhotoListing("lighthouse", false), new PhotoListing("market stalls", true)]);
        var previews = page.Previews();
        var single = new PhotoListing("old mill", true).Preview();
        var loaded = FullPhoto.Loaded - before;

        Expect.That(previews == "red fox, small preview / lighthouse, small preview / market stalls, small preview", "wrongPreviews", new { expected = "red fox, small preview / lighthouse, small preview / market stalls, small preview", actual = previews });
        Expect.That(single == "old mill, small preview", "wrongPreview", new { expected = "old mill, small preview", actual = single });
        Expect.That(loaded == 0, "loadedForPreview", new { loaded });
    }

    [Check("first-download-loads-once")]
    static void FirstDownloadLoadsOnce()
    {
        var before = FullPhoto.Loaded;
        var listing = new PhotoListing("red fox", true);
        var early = FullPhoto.Loaded - before;
        Expect.That(early == 0, "loadedTooEarly", new { loaded = early });

        listing.Download();
        var first = FullPhoto.Loaded - before;
        Expect.That(first == 1, "notLoadedOnFirstDownload", new { loaded = first });

        listing.Download();
        listing.Download();
        var loaded = FullPhoto.Loaded - before;
        Expect.That(loaded == 1, "loadedMoreThanOnce", new { loaded });
    }

    [Check("no-licence-no-download")]
    static void NoLicenceNoDownload()
    {
        var before = FullPhoto.Loaded;
        var listing = new PhotoListing("lighthouse", false);
        var first = listing.Download();
        var second = listing.Download();
        var loaded = FullPhoto.Loaded - before;

        Expect.That(first == "Buy a licence to download lighthouse" && second == first, "wrongRefusal", new { first, second });
        Expect.That(loaded == 0, "loadedWithoutLicence", new { loaded });
    }

    [Check("listing-matches-the-photo")]
    static void ListingMatchesThePhoto()
    {
        var listing = new PhotoListing("market stalls", true);
        var preview = listing.Preview();
        var download = listing.Download();
        var photo = new FullPhoto("market stalls");
        var realPreview = photo.Preview();
        var realDownload = photo.Download();

        Expect.That(preview == realPreview && download == realDownload && realDownload == "market stalls.jpg, 6000 x 4000",
            "differentFromPhoto", new { preview, download, realPreview, realDownload });
    }

    [Check("listing-is-a-photo")]
    static void ListingIsAPhoto()
    {
        Expect.That(typeof(IPhoto).IsAssignableFrom(typeof(FullPhoto)), "fullNotAPhoto");
        Expect.That(typeof(IPhoto).IsAssignableFrom(typeof(PhotoListing)), "listingNotAPhoto");
        Expect.That(!typeof(FullPhoto).IsAssignableFrom(typeof(PhotoListing)), "listingIsFull");
    }
}
