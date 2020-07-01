import React, { useEffect } from "react";
import { Wrapper } from "./ChatUI.style";
import { Menu } from "features/chat/Menu/Menu";
import { CurrentConversation } from "features/currentConversation/CurrentConversation/CurrentConversation";
import { ConversationMembers } from "features/conversationMembers/ConversationMembers/ConversationMembers";
import { JoinConversationDialog } from "features/joinedConversations/JoinConversationDialog/JoinConversationDialog";
import { UserDetailDialog } from "features/userDetail/UserDetailDialog/UserDetailDialog";
import { RtcDisplay } from "features/rtc/RtcDisplay/RtcDisplay";

const ChatUI = () => {
  // run this once
  useEffect(() => {
    let unlocked = false;
    document.body.addEventListener("touchstart", function() {
      if (!unlocked && document.querySelector("#ring")) {
        unlocked = true;
        const audioElem = document.querySelector("#ring") as any;
        audioElem.play();
        audioElem.pause();
        audioElem.currentTime = 0;
      }
    });
    document.addEventListener("click", function() {
      if (!unlocked && document.querySelector("#ring")) {
        unlocked = true;
        const audioElem = document.querySelector("#ring") as any;
        audioElem.play();
        audioElem.pause();
        audioElem.currentTime = 0;
      }
    });
  }, []);

  return (
    <Wrapper>
      <Menu />
      <CurrentConversation />
      <ConversationMembers />
      <JoinConversationDialog />
      <UserDetailDialog />
      <RtcDisplay></RtcDisplay>
      <audio id="ring" src="/ring.wav" preload="preload" loop={true}></audio>
    </Wrapper>
  );
};

export { ChatUI };
