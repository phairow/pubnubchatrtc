import styled from "styled-components/macro";

export const Wrapper = styled.div<{ displayed: boolean }>`
  z-index: 1000;
  position: fixed;
  max-width: 80%;
  max-height: 80%;
  width: 80%;
  height: 80%;
  background: black;
  color: white;
  line-height: normal;
  display: ${({ theme, displayed }) => (displayed ? "flex" : "none")};
  flex-direction: column;
`;

export const VideoWrapper = styled.div`
  resize: both;
  overflow: auto;
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

export const LocalVideoWrapper = styled.div`
  padding-right: 40px;
  float: right;
  display: inline-block;
  max-width: 20%;
  max-height: 20%;
  width: 20%;
  height: 20%;
`;

export const RemoteVideoWrapper = styled.div`
  padding-left: 40px;
  float: left;
  display: inline-block;
  max-width: 50%;
  max-height: 50%;
  width: 50%;
  height: 50%;
`;

export const MyVideo = styled.video`
  object-fit: scale-down;
`;

export const RemoteVideo = styled.video`
  object-fit: scale-down;
`;
