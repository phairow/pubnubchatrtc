import styled from "styled-components/macro";

export const Wrapper = styled.div<{ displayed: boolean }>`
  z-index: 1000;
  position: fixed;
  background: black;
  color: white;
  line-height: normal;
  display: ${({ theme, displayed }) => (displayed ? "flex" : "none")};
  flex-direction: column;
`;

export const VideoWrapper = styled.div`
  resize: both;
  overflow: auto;
  max-width: 90%;
  max-height: 90%;
  width: 90%;
  height: 90%;
  & video {
    margin: -2px;
    padding: 2px;
    width: 100%;
    height: 100%;
  }
`;

export const CloseButton = styled.div`
  margin-top: 2px;
  margin-right: 2px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.normalText};
`;

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  border-bottom-style: solid;
  border-bottom-width: 1px;
  border-bottom-color: ${({ theme }) => theme.colors.neutral[3]};
`;

export const Body = styled.div``;

export const Title = styled.div`
  padding-left: 10px;
  padding-right: 10px;
  display: flex;
  align-items: center;
  background: ${({ theme }) => theme.backgrounds.primary};
  color: ${({ theme }) => theme.colors.onPrimary};
  font-size: ${({ theme }) => theme.fontSizes.medium};
  font-family: ${({ theme }) => theme.fonts.app};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  text-align: left;
`;

export const MyVideo = styled.video`
  max-width: 25%;
  max-height: 25%;
  width: 25%;
  height: 25%;
  object-fit: contain;
`;

export const RemoteVideo = styled.video`
  max-width: 80%;
  max-height: 80%;
  width: 80%;
  height: 80%;
  object-fit: contain;
`;
