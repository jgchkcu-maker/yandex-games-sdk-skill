ysdk.adv.showRewardedVideo({
    onRewarded: () => { giveReward(); },
    onClose: (wasShown) => { console.log("closed"); }
});
