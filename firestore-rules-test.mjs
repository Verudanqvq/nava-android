import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const projectId = 'nava-01';
const rules = fs.readFileSync('firestore.rules','utf8');
const env = await initializeTestEnvironment({projectId, firestore:{host:'127.0.0.1',port:8080,rules}});

try {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db,'users/u1'),{uid:'u1',username:'user_one',displayName:'User One',photoURL:'',avatarType:'preset',avatarId:'dragon',bio:'',publicFavorites:true,publicLibrary:true,publicRatings:true,publicComments:true});
    await setDoc(doc(db,'users/u2'),{uid:'u2',username:'user_two',displayName:'User Two',photoURL:'',avatarType:'preset',avatarId:'dragon',bio:'',publicFavorites:false,publicLibrary:false,publicRatings:false,publicComments:false});
    await setDoc(doc(db,'staff/admin1'),{role:'admin'});
    await setDoc(doc(db,'posts/p1/comments/c1'),{id:'c1',postId:'p1',uid:'u2',text:'hello',status:'visible',likeCount:0});
    await setDoc(doc(db,'users/u2/notifications/n1'),{notificationId:'n1',recipientUid:'u2',actorUid:'u1',type:'like',read:false});
  });

  const anon = env.unauthenticatedContext().firestore();
  const u1 = env.authenticatedContext('u1',{email:'u1@example.com',email_verified:true}).firestore();
  const u2 = env.authenticatedContext('u2',{email:'u2@example.com',email_verified:true}).firestore();
  const admin = env.authenticatedContext('admin1',{email:'admin@nava.test',email_verified:true}).firestore();
  const unverified = env.authenticatedContext('u3',{email:'u3@example.com',email_verified:false}).firestore();

  await assertSucceeds(getDoc(doc(anon,'users/u1')));
  await assertSucceeds(getDoc(doc(anon,'usernames/free_name')));
  await assertFails(setDoc(doc(anon,'users/anon'),{uid:'anon'}));

  await assertSucceeds(setDoc(doc(u1,'users/u1/library/book1'),{id:'book1',title:'Book',savedAt:new Date()}));
  await assertSucceeds(getDoc(doc(anon,'users/u1/library/book1')));
  await assertFails(setDoc(doc(u1,'users/u2/library/hack'),{id:'hack'}));
  await assertFails(setDoc(doc(unverified,'users/u3/library/book'),{id:'book'}));

  await assertSucceeds(setDoc(doc(u1,'usernames/user_one_alt'),{uid:'u1'}));
  await assertFails(setDoc(doc(u1,'usernames/stolen'),{uid:'u2'}));

  await assertSucceeds(setDoc(doc(u1,'users/u1/reading/v1'),{title:'Volume',lastReadAt:new Date()}));
  await assertFails(getDoc(doc(anon,'users/u1/reading/v1')));

  await assertSucceeds(setDoc(doc(u1,'seriesFollowers/series1'),{seriesId:'series1',title:'Series',url:'https://www.verudanava.com/p/series.html'}));
  await assertSucceeds(setDoc(doc(u1,'seriesFollowers/series1/users/u1'),{uid:'u1',seriesId:'series1',title:'Series',url:'https://www.verudanava.com/p/series.html'}));
  await assertFails(getDoc(doc(u2,'seriesFollowers/series1/users/u1')));
  await assertSucceeds(getDoc(doc(admin,'seriesFollowers/series1/users/u1')));

  await assertSucceeds(setDoc(doc(u1,'devicePushTokens/device1'),{uid:'u1',token:'abc',platform:'android',appVersion:'12.1.33'}));
  await assertFails(setDoc(doc(u2,'devicePushTokens/device2'),{uid:'u1',token:'abc'}));

  await assertSucceeds(setDoc(doc(u1,'users/u2/notifications/like_c1_u1'),{notificationId:'like_c1_u1',recipientUid:'u2',actorUid:'u1',type:'like',postId:'p1',commentId:'c1',read:false}));
  await assertFails(setDoc(doc(u1,'users/u2/notifications/system_fake'),{notificationId:'system_fake',recipientUid:'u2',actorUid:'u1',type:'system',read:false}));
  await assertSucceeds(deleteDoc(doc(u1,'users/u2/notifications/n1')));

  await assertSucceeds(updateDoc(doc(u1,'posts/p1/comments/c1'),{likeCount:1,updatedAt:new Date()}));
  await assertFails(updateDoc(doc(u1,'posts/p1/comments/c1'),{text:'hacked',updatedAt:new Date()}));
  await assertSucceeds(updateDoc(doc(admin,'posts/p1/comments/c1'),{text:'',status:'deleted',updatedAt:new Date()}));

  await assertSucceeds(setDoc(doc(u1,'reports/r1'),{reportId:'r1',reporterUid:'u1',status:'open',reason:'spam'}));
  await assertFails(getDoc(doc(u1,'reports/r1')));
  await assertSucceeds(getDoc(doc(admin,'reports/r1')));

  await assertSucceeds(setDoc(doc(u1,'adminProfiles/u1'),{uid:'u1',customAvatarURL:'',bannerType:'preset',bannerId:'blue',bannerURL:'',glow:false}));
  await assertFails(setDoc(doc(u1,'adminProfiles/u1'),{uid:'u1',customAvatarURL:'data:image/png;base64,x',bannerType:'custom',bannerId:'',bannerURL:'data:image/png;base64,x',glow:true}));
  await assertSucceeds(setDoc(doc(admin,'adminProfiles/admin1'),{uid:'admin1',customAvatarURL:'data:image/png;base64,x',bannerType:'custom',bannerId:'',bannerURL:'data:image/png;base64,x',glow:true}));

  console.log('RULES_TEST_OK');
} finally {
  await env.cleanup();
}
