export interface ApologeticsVerse {
  reference: string;
  text: string;
}

export const APOLOGETICS_VERSES: ApologeticsVerse[] = [
  { reference: "1 Peter 3:15", text: "But in your hearts revere Christ as Lord. Always be prepared to give an answer to everyone who asks you to give the reason for the hope that you have. But do this with gentleness and respect." },
  { reference: "Jude 1:3", text: "Dear friends, although I was very eager to write to you about the salvation we share, I felt compelled to write and urge you to contend for the faith that was once for all entrusted to God's holy people." },
  { reference: "2 Timothy 2:15", text: "Do your best to present yourself to God as one approved, a worker who does not need to be ashamed and who correctly handles the word of truth." },
  { reference: "Colossians 4:6", text: "Let your conversation be always full of grace, seasoned with salt, so that you may know how to answer everyone." },
  { reference: "2 Corinthians 10:5", text: "We demolish arguments and every pretension that sets itself up against the knowledge of God, and we take captive every thought to make it obedient to Christ." },
  { reference: "Philippians 1:7", text: "It is right for me to feel this way about all of you, since I have you in my heart and, whether I am in chains or defending and confirming the gospel, all of you share in God's grace with me." },
  { reference: "Acts 17:11", text: "Now the Berean Jews were of more noble character than those in Thessalonica, for they received the message with great eagerness and examined the Scriptures every day to see if what Paul said was true." },
  { reference: "Romans 1:16", text: "For I am not ashamed of the gospel, because it is the power of God that brings salvation to everyone who believes: first to the Jew, then to the Gentile." },
  { reference: "Isaiah 1:18", text: "Come now, let us reason together, says the LORD: though your sins are like scarlet, they shall be as white as snow; though they are red like crimson, they shall become like wool." },
  { reference: "Hebrews 11:1", text: "Now faith is confidence in what we hope for and assurance about what we do not see." },
  { reference: "John 14:6", text: "Jesus answered, I am the way and the truth and the life. No one comes to the Father except through me." },
  { reference: "Matthew 22:37", text: "Jesus replied: 'Love the Lord your God with all your heart and with all your soul and with all your mind.'" },
  { reference: "Romans 12:2", text: "Do not conform to the pattern of this world, but be transformed by the renewing of your mind. Then you will be able to test and approve what God's will is — his good, pleasing and perfect will." },
  { reference: "Proverbs 3:5-6", text: "Trust in the LORD with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight." },
  { reference: "1 John 4:1", text: "Dear friends, do not believe every spirit, but test the spirits to see whether they are from God, because many false prophets have gone out into the world." },
  { reference: "Acts 4:12", text: "Salvation is found in no one else, for there is no other name under heaven given to mankind by which we must be saved." },
  { reference: "Psalm 19:1", text: "The heavens declare the glory of God; the skies proclaim the work of his hands." },
  { reference: "Romans 10:17", text: "Consequently, faith comes from hearing the message, and the message is heard through the word about Christ." },
  { reference: "John 1:1", text: "In the beginning was the Word, and the Word was with God, and the Word was God." },
  { reference: "Matthew 5:16", text: "In the same way, let your light shine before others, that they may see your good deeds and glorify your Father in heaven." },
  { reference: "2 Peter 1:21", text: "For prophecy never had its origin in the human will, but prophets, though human, spoke from God as they were carried along by the Holy Spirit." },
  { reference: "Romans 3:23", text: "For all have sinned and fall short of the glory of God." },
  { reference: "Ephesians 6:11", text: "Put on the full armor of God, so that you can take your stand against the devil's schemes." },
  { reference: "Titus 1:9", text: "He must hold firmly to the trustworthy message as it has been taught, so that he can encourage others by sound doctrine and refute those who oppose it." },
  { reference: "Luke 24:45", text: "Then he opened their minds so they could understand the Scriptures." },
  { reference: "1 Corinthians 15:3-4", text: "For what I received I passed on to you as of first importance: that Christ died for our sins according to the Scriptures, that he was buried, that he was raised on the third day according to the Scriptures." },
  { reference: "John 17:17", text: "Sanctify them by the truth; your word is truth." },
  { reference: "Psalm 119:105", text: "Your word is a lamp for my feet, a light on my path." },
  { reference: "Deuteronomy 6:5", text: "Love the LORD your God with all your heart and with all your soul and with all your strength." },
  { reference: "Micah 6:8", text: "He has shown you, O mortal, what is good. And what does the LORD require of you? To act justly and to love mercy and to walk humbly with your God." },
];

/** Returns a deterministic verse for a given calendar date (rotates daily). */
export function getDailyVerse(date: Date = new Date()): ApologeticsVerse {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return APOLOGETICS_VERSES[dayOfYear % APOLOGETICS_VERSES.length];
}
